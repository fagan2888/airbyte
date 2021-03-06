"""
MIT License

Copyright (c) 2020 Airbyte

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""

import json
import os
import tempfile
import uuid

import boto3
import pytest
from base_python import AirbyteLogger
from botocore.errorfactory import ClientError
from google.api_core.exceptions import Conflict
from google.cloud import storage
from source_file import SourceFile


class TestSourceFile(object):
    service_account_file: str = "../secrets/gcs.json"
    aws_credentials: str = "../secrets/aws.json"
    cloud_bucket_name: str = "airbytetestbucket"

    @pytest.fixture(scope="class")
    def download_gcs_public_data(self):
        print("\nDownload public dataset from gcs to local /tmp")
        config = get_config()
        config["storage"] = "HTTPS"
        config["url"] = "https://storage.googleapis.com/covid19-open-data/v2/latest/epidemiology.csv"
        df = run_load_dataframes(config)
        tmp_file = tempfile.NamedTemporaryFile(delete=False)
        df.to_csv(tmp_file.name, index=False)
        yield tmp_file.name
        os.remove(tmp_file.name)
        print(f"\nLocal File {tmp_file.name} is now deleted")

    # @pytest.fixture(scope="class")
    def create_gcs_private_data(self, download_gcs_public_data):
        storage_client = storage.Client.from_service_account_json(self.service_account_file)
        bucket_name = create_unique_gcs_bucket(storage_client, self.cloud_bucket_name)
        print(f"\nUpload dataset to private gcs bucket {bucket_name}")
        bucket = storage_client.get_bucket(bucket_name)
        blob = bucket.blob("myfile.csv")
        blob.upload_from_filename(download_gcs_public_data)
        yield f"{bucket_name}/myfile.csv"
        bucket.delete(force=True)
        print(f"\nGCS Bucket {bucket_name} is now deleted")

    # @pytest.fixture(scope="class")
    def create_aws_private_data(self, download_gcs_public_data):
        with open(self.aws_credentials) as json_file:
            aws_config = json.load(json_file)
        region = "eu-west-3"
        location = {"LocationConstraint": region}
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=aws_config["aws_access_key_id"],
            aws_secret_access_key=aws_config["aws_secret_access_key"],
            region_name=region,
        )
        bucket_name = self.cloud_bucket_name
        print(f"\nUpload dataset to private aws bucket {bucket_name}")
        try:
            s3_client.head_bucket(Bucket=bucket_name)
        except ClientError:
            s3_client.create_bucket(Bucket=bucket_name, CreateBucketConfiguration=location)
        s3_client.upload_file(download_gcs_public_data, bucket_name, "myfile.csv")
        yield f"{bucket_name}/myfile.csv"
        s3 = boto3.resource(
            "s3", aws_access_key_id=aws_config["aws_access_key_id"], aws_secret_access_key=aws_config["aws_secret_access_key"]
        )
        bucket = s3.Bucket(bucket_name)
        bucket.objects.all().delete()
        print(f"\nS3 Bucket {bucket_name} is now deleted")

    @pytest.mark.parametrize(
        "reader_impl, storage, url",
        [
            ("gcfs", "HTTPS", "https://storage.googleapis.com/covid19-open-data/v2/latest/epidemiology.csv"),
            ("smart_open", "HTTPS", "storage.googleapis.com/covid19-open-data/v2/latest/epidemiology.csv"),
            ("smart_open", "local", "injected by tests"),
        ],
    )
    def test_local_data(self, download_gcs_public_data, reader_impl, storage, url):
        config = get_config()
        config["storage"] = storage
        if storage != "local":
            config["url"] = url
        else:
            # inject temp file path that was downloaded by the test as URL
            config["url"] = download_gcs_public_data
        config["reader_impl"] = reader_impl
        run_load_dataframes(config)

    # @pytest.mark.parametrize("reader_impl", ["gcsfs", "smart_open"])
    # def test_remote_gcs_load(self, create_gcs_private_data, reader_impl):
    #     config = get_config()
    #     config["storage"] = "GCS"
    #     config["url"] = create_gcs_private_data
    #     config["reader_impl"] = reader_impl
    #     with open(self.service_account_file) as json_file:
    #         config["service_account_json"] = json.dumps(json.load(json_file))
    #     run_load_dataframes(config)

    # @pytest.mark.parametrize("reader_impl", ["s3fs", "smart_open"])
    # def test_remote_aws_load(self, create_aws_private_data, reader_impl):
    #     config = get_config()
    #     config["storage"] = "S3"
    #     config["url"] = create_aws_private_data
    #     config["reader_impl"] = reader_impl
    #     with open(self.aws_credentials) as json_file:
    #         aws_config = json.load(json_file)
    #     config["aws_access_key_id"] = aws_config["aws_access_key_id"]
    #     config["aws_secret_access_key"] = aws_config["aws_secret_access_key"]
    #     run_load_dataframes(config)


def run_load_dataframes(config):
    df_list = SourceFile.load_dataframes(config=config, logger=AirbyteLogger(), skip_data=False)
    assert len(df_list) == 1  # Properly load 1 DataFrame
    df = df_list[0]
    assert len(df.columns) == 10  # DataFrame should have 10 columns
    assert len(df.index) == 42  # DataFrame should have 42 rows of data
    return df


def get_config():
    return {"format": "csv", "reader_options": '{"sep": ",", "nrows": 42}'}


def create_unique_gcs_bucket(storage_client, name: str) -> str:
    """
    Make a unique bucket to which we'll upload the file.
    (GCS buckets are part of a single global namespace.)
    """
    for i in range(0, 5):
        bucket_name = f"{name}-{uuid.uuid1()}"
        try:
            bucket = storage_client.bucket(bucket_name)
            bucket.storage_class = "STANDARD"
            # fixed locations are cheaper...
            storage_client.create_bucket(bucket, location="us-east1")
            print(f"\nNew GCS bucket created {bucket_name}")
            return bucket_name
        except Conflict:
            print(f"\nError: {bucket_name} already exists!")
