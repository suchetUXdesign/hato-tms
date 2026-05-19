import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CRStatus } from '@hato-tms/shared'
import {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  reviewChangeRequest,
  publishChangeRequest,
  getUsers,
  type CreateCRPayload,
  type ReviewCRPayload,
} from '@/shared/api/changeRequests'

export function useChangeRequests(status?: CRStatus) {
  return useQuery({
    queryKey: ['change-requests', status],
    queryFn: () => getChangeRequests(status),
  })
}

export function useChangeRequest(id: string | null) {
  return useQuery({
    queryKey: ['change-request', id],
    queryFn: () => getChangeRequest(id!),
    enabled: !!id,
  })
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
}

export function useCreateChangeRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCRPayload) => createChangeRequest(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
  })
}

export function useReviewChangeRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReviewCRPayload) => reviewChangeRequest(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-request', id] })
      qc.invalidateQueries({ queryKey: ['change-requests'] })
    },
  })
}

export function usePublishChangeRequest(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => publishChangeRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['change-request', id] })
      qc.invalidateQueries({ queryKey: ['change-requests'] })
      qc.invalidateQueries({ queryKey: ['keys'] })
    },
  })
}
