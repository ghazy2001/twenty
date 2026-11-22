import { isDefined } from 'twenty-shared/utils';

import { type GroupByField } from 'src/engine/api/common/common-query-runners/types/group-by-field.type';
import { isGroupByRelationField } from 'src/engine/api/common/common-query-runners/utils/is-group-by-relation-field.util';
import { assertFieldIsReadableOrThrow } from 'src/engine/api/common/common-query-parsers/utils/assert-field-is-readable-or-throw.util';
import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/permissions/permissions.exception';
import { type RecordReadRestrictions } from 'src/engine/permissions/types/record-read-restrictions.type';

export const assertGroupByFieldsAreReadableOrThrow = ({
  groupByFields,
  flatObjectMetadata,
  flatObjectMetadataMaps,
  recordReadRestrictions,
}: {
  groupByFields: GroupByField[];
  flatObjectMetadata: FlatObjectMetadata;
  flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>;
  recordReadRestrictions?: RecordReadRestrictions;
}): void => {
  for (const groupByField of groupByFields) {
    if (isGroupByRelationField(groupByField)) {
      assertFieldIsReadableOrThrow({
        recordReadRestrictions,
        flatObjectMetadata,
        flatFieldMetadata: groupByField.fieldMetadata,
      });

      const targetObjectMetadata =
        isDefined(groupByField.fieldMetadata.relationTargetObjectMetadataId)
          ? findFlatEntityByIdInFlatEntityMaps({
              flatEntityId:
                groupByField.fieldMetadata.relationTargetObjectMetadataId,
              flatEntityMaps: flatObjectMetadataMaps,
            })
          : undefined;

      if (
        isDefined(targetObjectMetadata) &&
        recordReadRestrictions?.unreadableObjectMetadataIds.has(
          targetObjectMetadata.id,
        )
      ) {
        throw new PermissionsException(
          PermissionsExceptionMessage.PERMISSION_DENIED,
          PermissionsExceptionCode.PERMISSION_DENIED,
        );
      }

      if (isDefined(targetObjectMetadata)) {
        assertFieldIsReadableOrThrow({
          recordReadRestrictions,
          flatObjectMetadata: targetObjectMetadata,
          flatFieldMetadata: groupByField.nestedFieldMetadata,
        });
      }
    } else {
      assertFieldIsReadableOrThrow({
        recordReadRestrictions,
        flatObjectMetadata,
        flatFieldMetadata: groupByField.fieldMetadata,
      });
    }
  }
};
