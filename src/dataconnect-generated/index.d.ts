import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Announcement_Key {
  id: UUIDString;
  __typename?: 'Announcement_Key';
}

export interface Club_Key {
  id: UUIDString;
  __typename?: 'Club_Key';
}

export interface CreateClubData {
  club_insert: Club_Key;
}

export interface Event_Key {
  id: UUIDString;
  __typename?: 'Event_Key';
}

export interface GetMyRsvPsData {
  rSVPS: ({
    id: UUIDString;
    event: {
      id: UUIDString;
      title: string;
      eventDate: DateString;
      startTime: string;
    } & Event_Key;
      status: string;
  } & RSVP_Key)[];
}

export interface ListEventsData {
  events: ({
    id: UUIDString;
    title: string;
    description?: string | null;
    eventDate: DateString;
    startTime: string;
    endTime: string;
    location?: string | null;
    maxAttendees?: number | null;
  } & Event_Key)[];
}

export interface Member_Key {
  id: UUIDString;
  __typename?: 'Member_Key';
}

export interface RSVP_Key {
  id: UUIDString;
  __typename?: 'RSVP_Key';
}

export interface UpdateMemberData {
  member_update?: Member_Key | null;
}

export interface UpdateMemberVariables {
  memberId: UUIDString;
  isAdmin: boolean;
}

interface CreateClubRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateClubData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<CreateClubData, undefined>;
  operationName: string;
}
export const createClubRef: CreateClubRef;

export function createClub(): MutationPromise<CreateClubData, undefined>;
export function createClub(dc: DataConnect): MutationPromise<CreateClubData, undefined>;

interface ListEventsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListEventsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListEventsData, undefined>;
  operationName: string;
}
export const listEventsRef: ListEventsRef;

export function listEvents(): QueryPromise<ListEventsData, undefined>;
export function listEvents(dc: DataConnect): QueryPromise<ListEventsData, undefined>;

interface UpdateMemberRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateMemberVariables): MutationRef<UpdateMemberData, UpdateMemberVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateMemberVariables): MutationRef<UpdateMemberData, UpdateMemberVariables>;
  operationName: string;
}
export const updateMemberRef: UpdateMemberRef;

export function updateMember(vars: UpdateMemberVariables): MutationPromise<UpdateMemberData, UpdateMemberVariables>;
export function updateMember(dc: DataConnect, vars: UpdateMemberVariables): MutationPromise<UpdateMemberData, UpdateMemberVariables>;

interface GetMyRsvPsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyRsvPsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyRsvPsData, undefined>;
  operationName: string;
}
export const getMyRsvPsRef: GetMyRsvPsRef;

export function getMyRsvPs(): QueryPromise<GetMyRsvPsData, undefined>;
export function getMyRsvPs(dc: DataConnect): QueryPromise<GetMyRsvPsData, undefined>;

