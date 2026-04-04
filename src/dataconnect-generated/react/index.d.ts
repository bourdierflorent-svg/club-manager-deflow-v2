import { CreateClubData, ListEventsData, UpdateMemberData, UpdateMemberVariables, GetMyRsvPsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateClub(options?: useDataConnectMutationOptions<CreateClubData, FirebaseError, void>): UseDataConnectMutationResult<CreateClubData, undefined>;
export function useCreateClub(dc: DataConnect, options?: useDataConnectMutationOptions<CreateClubData, FirebaseError, void>): UseDataConnectMutationResult<CreateClubData, undefined>;

export function useListEvents(options?: useDataConnectQueryOptions<ListEventsData>): UseDataConnectQueryResult<ListEventsData, undefined>;
export function useListEvents(dc: DataConnect, options?: useDataConnectQueryOptions<ListEventsData>): UseDataConnectQueryResult<ListEventsData, undefined>;

export function useUpdateMember(options?: useDataConnectMutationOptions<UpdateMemberData, FirebaseError, UpdateMemberVariables>): UseDataConnectMutationResult<UpdateMemberData, UpdateMemberVariables>;
export function useUpdateMember(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateMemberData, FirebaseError, UpdateMemberVariables>): UseDataConnectMutationResult<UpdateMemberData, UpdateMemberVariables>;

export function useGetMyRsvPs(options?: useDataConnectQueryOptions<GetMyRsvPsData>): UseDataConnectQueryResult<GetMyRsvPsData, undefined>;
export function useGetMyRsvPs(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyRsvPsData>): UseDataConnectQueryResult<GetMyRsvPsData, undefined>;
