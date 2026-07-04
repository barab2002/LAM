import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import type {
  ClothingItemDto,
  DailySuggestionsResponse,
  DeclutterItemDto,
  FeedbackRequest,
  LogWearRequest,
  LookDto,
  UpdateItemRequest,
  UpdateProfileRequest,
  UserProfileDto,
  WearHistoryDto,
} from '../types/api';
import { createApiClient } from './client';

export function useApi() {
  const { getAuthHeaders } = useAuth();
  return useMemo(() => createApiClient(getAuthHeaders), [getAuthHeaders]);
}

// ---------- Closet ----------

export interface ItemFilters {
  category?: string;
  color?: string;
  season?: string;
  favorite?: boolean;
  archived?: boolean;
}

function itemsQueryString(filters: ItemFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.color) params.set('color', filters.color);
  if (filters.season) params.set('season', filters.season);
  if (filters.favorite !== undefined) params.set('favorite', String(filters.favorite));
  if (filters.archived !== undefined) params.set('archived', String(filters.archived));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useItems(filters: ItemFilters = {}) {
  const api = useApi();
  return useQuery({
    queryKey: ['items', filters],
    queryFn: () => api.get<ClothingItemDto[]>(`/items${itemsQueryString(filters)}`),
  });
}

export function useItem(id: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['items', 'detail', id],
    queryFn: () => api.get<ClothingItemDto>(`/items/${id}`),
    enabled: Boolean(id),
  });
}

export function useUploadItem() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      api.upload<{ item: ClothingItemDto; aiTagged: boolean }>('/items/upload', form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useUpdateItem(id: string) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateItemRequest) => api.patch<ClothingItemDto>(`/items/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

export function useDeleteItem() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
}

// ---------- Looks ----------

export function useLooks() {
  const api = useApi();
  return useQuery({ queryKey: ['looks'], queryFn: () => api.get<LookDto[]>('/looks') });
}

export function useCreateLook() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; itemIds: string[] }) =>
      api.post<LookDto>('/looks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['looks'] }),
  });
}

// ---------- Calendar / wear history ----------

export function useWearHistory(month: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['wear-history', month],
    queryFn: () => api.get<WearHistoryDto[]>(`/wear-history?month=${month}`),
  });
}

export function useLogWear() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LogWearRequest) => api.post<WearHistoryDto>('/wear-history', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wear-history'] });
      qc.invalidateQueries({ queryKey: ['items'] });
      qc.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

// ---------- Suggestions & feedback ----------

export function useSuggestions(coords?: { lat: number; lon: number }) {
  const api = useApi();
  const qs = coords ? `?lat=${coords.lat}&lon=${coords.lon}` : '';
  return useQuery({
    queryKey: ['suggestions', coords ?? null],
    queryFn: () => api.get<DailySuggestionsResponse>(`/suggestions/daily${qs}`),
    staleTime: 10 * 60 * 1000,
  });
}

export function useSendFeedback() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FeedbackRequest) =>
      api.post<{ look: LookDto; liked: boolean }>('/feedback', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['looks'] }),
  });
}

// ---------- Profile & insights ----------

export function useProfile() {
  const api = useApi();
  return useQuery({ queryKey: ['profile'], queryFn: () => api.get<UserProfileDto>('/profile') });
}

export function useUpdateProfile() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => api.patch<UserProfileDto>('/profile', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['suggestions'] });
    },
  });
}

export function useDeclutter() {
  const api = useApi();
  return useQuery({
    queryKey: ['insights', 'declutter'],
    queryFn: () => api.get<DeclutterItemDto[]>('/insights/declutter'),
  });
}
