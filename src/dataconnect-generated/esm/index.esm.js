import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'club-manager',
  location: 'us-east4'
};

export const createClubRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateClub');
}
createClubRef.operationName = 'CreateClub';

export function createClub(dc) {
  return executeMutation(createClubRef(dc));
}

export const listEventsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEvents');
}
listEventsRef.operationName = 'ListEvents';

export function listEvents(dc) {
  return executeQuery(listEventsRef(dc));
}

export const updateMemberRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMember', inputVars);
}
updateMemberRef.operationName = 'UpdateMember';

export function updateMember(dcOrVars, vars) {
  return executeMutation(updateMemberRef(dcOrVars, vars));
}

export const getMyRsvPsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyRSVPs');
}
getMyRsvPsRef.operationName = 'GetMyRSVPs';

export function getMyRsvPs(dc) {
  return executeQuery(getMyRsvPsRef(dc));
}

