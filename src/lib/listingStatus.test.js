import { describe, it, expect } from 'vitest'
import { buildListingStatusUpdate } from './listingStatus'

describe('listingStatus v9.20 (E8): one approve path', () => {
  it('approving sets status + Cherry verification, like AdminPage handleApprove', () => {
    expect(buildListingStatusUpdate('approved')).toEqual({
      status: 'approved',
      is_verified: true,
      verify_type: 'cherry',
    })
  })

  it('other statuses set only the status (no verification side effects)', () => {
    expect(buildListingStatusUpdate('suspended')).toEqual({ status: 'suspended' })
    expect(buildListingStatusUpdate('pending')).toEqual({ status: 'pending' })
    expect(buildListingStatusUpdate('rejected')).toEqual({ status: 'rejected' })
  })
})
