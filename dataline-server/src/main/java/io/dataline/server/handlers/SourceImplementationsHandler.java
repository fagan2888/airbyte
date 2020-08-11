package io.dataline.server.handlers;

import io.dataline.api.model.SourceImplementationCreate;
import io.dataline.api.model.SourceImplementationRead;
import io.dataline.config.SourceConnectionImplementation;
import io.dataline.config.persistence.ConfigPersistence;
import io.dataline.config.persistence.PersistenceConfigType;
import io.dataline.config.persistence.SourceConnectionImplementationValidation;
import java.util.UUID;

public class SourceImplementationsHandler {
  private final ConfigPersistence configPersistence;

  public SourceImplementationsHandler(ConfigPersistence configPersistence) {
    this.configPersistence = configPersistence;
  }

  public SourceImplementationRead createSourceImplementation(
      SourceImplementationCreate sourceImplementationCreate) {

    // validate configuration
    final SourceConnectionImplementationValidation validator =
        new SourceConnectionImplementationValidation(configPersistence);
    validator.validate(
        sourceImplementationCreate.getSourceSpecificationId(),
        sourceImplementationCreate.getConfiguration());

    // persist
    final UUID sourceImplementationId = UUID.randomUUID();
    final SourceConnectionImplementation sourceConnectionImplementation =
        new SourceConnectionImplementation();
    sourceConnectionImplementation.setSourceSpecificationId(
        sourceImplementationCreate.getSourceSpecificationId());
    sourceConnectionImplementation.setSourceImplementationId(sourceImplementationId);
    sourceConnectionImplementation.setConfiguration(sourceImplementationCreate.getConfiguration());

    configPersistence.writeConfig(
        PersistenceConfigType.SOURCE_CONNECTION_IMPLEMENTATION,
        sourceImplementationId.toString(),
        sourceConnectionImplementation);

    // read configuration from db
    final SourceConnectionImplementation sourceConnectionImplementation2 =
        configPersistence.getConfig(
            PersistenceConfigType.SOURCE_CONNECTION_IMPLEMENTATION,
            sourceImplementationId.toString(),
            SourceConnectionImplementation.class);

    return sourceConnectionImplementationToSourceImplementationRead(
        sourceConnectionImplementation2);
  }

  private SourceImplementationRead sourceConnectionImplementationToSourceImplementationRead(
      SourceConnectionImplementation sourceConnectionImplementation) {
    final SourceImplementationRead sourceImplementationRead = new SourceImplementationRead();
    sourceConnectionImplementation.setSourceImplementationId(
        sourceConnectionImplementation.getSourceImplementationId());
    sourceConnectionImplementation.setSourceSpecificationId(
        sourceConnectionImplementation.getSourceSpecificationId());
    sourceConnectionImplementation.setConfiguration(
        sourceConnectionImplementation.getConfiguration());

    return sourceImplementationRead;
  }
}