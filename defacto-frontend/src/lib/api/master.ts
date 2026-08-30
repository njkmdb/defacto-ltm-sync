import { apiClient } from './client';

export const getStatusOptions = async (category: string) => {
  const response = await apiClient.get(`/api/v1/core/statuses/options?category=${category}`);
  return response.data;
};

export const getStatuses = async (page: number = 1, limit: number = 20, categoryFilter?: string, searchConditions?: any[]) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (categoryFilter && categoryFilter !== 'ALL') params.append('category_filter', categoryFilter);
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }
  
  const response = await apiClient.get(`/api/v1/core/statuses?${params.toString()}`);
  return response.data;
};

export const createStatus = async (data: any) => {
  const response = await apiClient.post('/api/v1/core/statuses', data);
  return response.data;
};

export const updateStatus = async (statusId: number, data: any) => {
  const response = await apiClient.patch(`/api/v1/core/statuses/${statusId}`, data);
  return response.data;
};

export const deleteStatus = async (statusId: number) => {
  const response = await apiClient.delete(`/api/v1/core/statuses/${statusId}`);
  return response.data;
};

export const deleteBulkStatuses = async (statusIds: number[]) => {
  const response = await apiClient.post('/api/v1/core/statuses/bulk-delete', { target_ids: statusIds });
  return response.data;
};

export const bulkUpsertStatuses = async (data: any[]) => {
  const response = await apiClient.post('/api/v1/core/statuses/bulk-upsert', { items: data });
  return response.data;
};

export const getEntityTypes = async () => {
  const response = await apiClient.get('/api/v1/core/entities/types');
  return response.data;
};

export const getEntities = async (page: number = 1, limit: number = 20, typeFilter?: string, searchConditions?: any[]) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (typeFilter && typeFilter !== 'ALL') params.append('type_filter', typeFilter);
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }
  
  const response = await apiClient.get(`/api/v1/core/entities?${params.toString()}`);
  return response.data;
};

export const createEntity = async (data: any) => {
  const response = await apiClient.post('/api/v1/core/entities', data);
  return response.data;
};

export const updateEntity = async (entityId: number, data: any) => {
  const response = await apiClient.patch(`/api/v1/core/entities/${entityId}`, data);
  return response.data;
};

export const deleteEntity = async (entityId: number) => {
  const response = await apiClient.delete(`/api/v1/core/entities/${entityId}`);
  return response.data;
};

export const deleteBulkEntities = async (entityIds: number[]) => {
  const response = await apiClient.post('/api/v1/core/entities/bulk-delete', { target_ids: entityIds });
  return response.data;
};

export const bulkUpsertEntities = async (data: any[]) => {
  const response = await apiClient.post('/api/v1/core/entities/bulk-upsert', { items: data });
  return response.data;
};

export const getObjectTypes = async () => {
  const response = await apiClient.get('/api/v1/core/objects/types');
  return response.data;
};

export const getObjects = async (page: number = 1, limit: number = 20, typeFilter?: string, searchConditions?: any[]) => {
  const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
  if (typeFilter && typeFilter !== 'ALL') params.append('type_filter', typeFilter);
  
  if (searchConditions && searchConditions.length > 0) {
    const validConds = searchConditions.filter(c => c.keyword.trim() !== '');
    if (validConds.length > 0) {
      params.append('search_conditions', JSON.stringify(validConds));
    }
  }
  
  const response = await apiClient.get(`/api/v1/core/objects?${params.toString()}`);
  return response.data;
};

export const createObject = async (data: any) => {
  const response = await apiClient.post('/api/v1/core/objects', data);
  return response.data;
};

export const updateObject = async (objectId: number, data: any) => {
  const response = await apiClient.patch(`/api/v1/core/objects/${objectId}`, data);
  return response.data;
};

export const deleteObject = async (objectId: number) => {
  const response = await apiClient.delete(`/api/v1/core/objects/${objectId}`);
  return response.data;
};

export const deleteBulkObjects = async (objectIds: number[]) => {
  const response = await apiClient.post('/api/v1/core/objects/bulk-delete', { target_ids: objectIds });
  return response.data;
};

export const bulkUpsertObjects = async (data: any[]) => {
  const response = await apiClient.post('/api/v1/core/objects/bulk-upsert', { items: data });
  return response.data;
};