import { FieldMetadataType } from 'twenty-shared/types';

import {
  type GroupByRegularField,
  type GroupByRelationField,
} from 'src/engine/api/common/common-query-runners/types/group-by-field.type';
import { assertGroupByFieldsAreReadableOrThrow } from 'src/engine/api/common/common-query-runners/utils/assert-group-by-fields-are-readable-or-throw.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { getFlatObjectMetadataMock } from 'src/engine/metadata-modules/flat-object-metadata/__mocks__/get-flat-object-metadata.mock';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { PermissionsExceptionCode } from 'src/engine/permissions/permissions.exception';

describe('assertGroupByFieldsAreReadableOrThrow', () => {
  const workspaceId = 'workspace-id';
  const objectMetadataId = 'person-object-id';
  const companyObjectMetadataId = 'company-object-id';

  const createMockField = (
    overrides: Partial<FlatFieldMetadata> & {
      id: string;
      name: string;
      type: FieldMetadataType;
    },
  ): FlatFieldMetadata =>
    ({
      workspaceId,
      objectMetadataId,
      isNullable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      universalIdentifier: overrides.id,
      label: overrides.name,
      ...overrides,
    }) as FlatFieldMetadata;

  const cityField = createMockField({
    id: 'city-field-id',
    type: FieldMetadataType.TEXT,
    name: 'city',
  });

  const companyRelationField = createMockField({
    id: 'company-relation-field-id',
    type: FieldMetadataType.RELATION,
    name: 'company',
    relationTargetObjectMetadataId: companyObjectMetadataId,
  });

  const companyIdField = createMockField({
    id: 'company-id-field-id',
    type: FieldMetadataType.UUID,
    name: 'id',
    objectMetadataId: companyObjectMetadataId,
  });

  const companyNameField = createMockField({
    id: 'company-name-field-id',
    type: FieldMetadataType.TEXT,
    name: 'name',
    objectMetadataId: companyObjectMetadataId,
  });

  const flatObjectMetadata = getFlatObjectMetadataMock({
    id: objectMetadataId,
    universalIdentifier: objectMetadataId,
    workspaceId,
    nameSingular: 'person',
    fieldIds: [cityField.id, companyRelationField.id],
  });

  const companyObjectMetadata = getFlatObjectMetadataMock({
    id: companyObjectMetadataId,
    universalIdentifier: companyObjectMetadataId,
    workspaceId,
    nameSingular: 'company',
    fieldIds: [companyIdField.id, companyNameField.id],
  });

  const flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata> = {
    byUniversalIdentifier: {
      [objectMetadataId]: flatObjectMetadata,
      [companyObjectMetadataId]: companyObjectMetadata,
    },
    universalIdentifierById: {
      [objectMetadataId]: objectMetadataId,
      [companyObjectMetadataId]: companyObjectMetadataId,
    },
    universalIdentifiersByApplicationId: {},
  };

  const scalarGroupByField: GroupByRegularField = {
    fieldMetadata: cityField,
  };

  const relationGroupByField: GroupByRelationField = {
    fieldMetadata: companyRelationField,
    nestedFieldMetadata: companyNameField,
  };

  const relationJoinColumnRegularGroupByField: GroupByRegularField = {
    fieldMetadata: companyRelationField,
  };

  const relationJoinColumnGroupByField: GroupByRelationField = {
    fieldMetadata: companyRelationField,
    nestedFieldMetadata: companyIdField,
  };

  const restrictionsOnField = (...fieldMetadataIds: string[]) => ({
    unreadableObjectMetadataIds: new Set<string>(),
    unreadableFieldMetadataIds: new Set(fieldMetadataIds),
  });

  const restrictionsOnObject = (unreadableObjectId: string) => ({
    unreadableObjectMetadataIds: new Set([unreadableObjectId]),
    unreadableFieldMetadataIds: new Set<string>(),
  });

  it('should not throw when recordReadRestrictions is undefined', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [scalarGroupByField, relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: undefined,
      }),
    ).not.toThrow();
  });

  it('should not throw when recordReadRestrictions has no unreadable fields or objects matching groupByFields', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [scalarGroupByField, relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField('other-field-id'),
      }),
    ).not.toThrow();
  });

  it('should reject grouping by a role-restricted scalar field', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [scalarGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(cityField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by a role-restricted relation field (companyId dimension)', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [relationJoinColumnRegularGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(companyRelationField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by a role-restricted relation field (company.id dimension)', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [relationJoinColumnGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(companyRelationField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by a role-restricted relation field (company.name dimension)', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(companyRelationField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by a relation when the target object is unreadable', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnObject(companyObjectMetadataId),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by a relation when nested target field is role-restricted', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(companyNameField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject when multiple groupBy fields are supplied and one is restricted', () => {
    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [scalarGroupByField, relationGroupByField],
        flatObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField(companyRelationField.id),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });

  it('should reject grouping by timelineActivity properties when any restriction exists', () => {
    const propertiesField = createMockField({
      id: 'properties-id',
      type: FieldMetadataType.RAW_JSON,
      name: 'properties',
    });
    const timelineActivityObjectMetadata = getFlatObjectMetadataMock({
      id: 'timeline-activity-id',
      universalIdentifier: 'timeline-activity-id',
      nameSingular: 'timelineActivity',
      fieldIds: [propertiesField.id],
    });

    expect(() =>
      assertGroupByFieldsAreReadableOrThrow({
        groupByFields: [{ fieldMetadata: propertiesField }],
        flatObjectMetadata: timelineActivityObjectMetadata,
        flatObjectMetadataMaps,
        recordReadRestrictions: restrictionsOnField('some-restricted-field'),
      }),
    ).toThrow(
      expect.objectContaining({
        code: PermissionsExceptionCode.PERMISSION_DENIED,
      }),
    );
  });
});
