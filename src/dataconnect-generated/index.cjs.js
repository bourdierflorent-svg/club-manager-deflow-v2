const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'club-manager',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const createClubRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateClub');
}
createClubRef.operationName = 'CreateClub';
exports.createClubRef = createClubRef;

exports.createClub = function createClub(dc) {
  return executeMutation(createClubRef(dc));
};

const listEventsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListEvents');
}
listEventsRef.operationName = 'ListEvents';
exports.listEventsRef = listEventsRef;

exports.listEvents = function listEvents(dc) {
  return executeQuery(listEventsRef(dc));
};

const updateMemberRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateMember', inputVars);
}
updateMemberRef.operationName = 'UpdateMember';
exports.updateMemberRef = updateMemberRef;

exports.updateMember = function updateMember(dcOrVars, vars) {
  return executeMutation(updateMemberRef(dcOrVars, vars));
};

const getMyRsvPsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyRSVPs');
}
getMyRsvPsRef.operationName = 'GetMyRSVPs';
exports.getMyRsvPsRef = getMyRsvPsRef;

exports.getMyRsvPs = function getMyRsvPs(dc) {
  return executeQuery(getMyRsvPsRef(dc));
};
