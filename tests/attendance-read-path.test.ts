import { AttendanceService } from '../src/features/attendance/services/attendance.service';

describe('AttendanceService effective status resolution', () => {
  it('uses the latest correction entry from an unsorted audit trail', () => {
    const record = {
      status: 'ABSENT',
      auditTrail: [
        { newValue: 'ABSENT', changedAt: new Date('2024-01-01T00:00:00.000Z') },
        { newValue: 'PRESENT', changedAt: new Date('2024-01-03T00:00:00.000Z') },
        { newValue: 'LATE', changedAt: new Date('2024-01-02T00:00:00.000Z') },
      ],
    };

    expect((AttendanceService as any).getEffectiveStatus(record)).toBe('PRESENT');
  });
});
