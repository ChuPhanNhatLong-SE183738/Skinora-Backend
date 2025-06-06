/**
 * Utility for managing doctor availability and time slots
 */

export interface TimeRange {
  start: string; 
  end: string;  
}

export interface DayAvailability {
  isAvailable: boolean;
  timeRanges: TimeRange[];
  timeSlots: string[];
}

export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export function generateTimeSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  
  const [startHour, startMinute] = start.split(':').map(num => parseInt(num, 10));
  const startTime = new Date();
  startTime.setHours(startHour, startMinute, 0, 0);
  
  const [endHour, endMinute] = end.split(':').map(num => parseInt(num, 10));
  const endTime = new Date();
  endTime.setHours(endHour, endMinute, 0, 0);
  
  if (endTime <= startTime) {
    endTime.setDate(endTime.getDate() + 1);
  }
  
  const currentTime = new Date(startTime);
  while (currentTime < endTime) {
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    slots.push(`${hours}:${minutes}`);
    
    currentTime.setMinutes(currentTime.getMinutes() + 30);
  }
  
  return slots;
}

export function processTimeRanges(dayAvailability: DayAvailability): DayAvailability {
  if (!dayAvailability.isAvailable || !dayAvailability.timeRanges?.length) {
    return {
      ...dayAvailability,
      timeSlots: []
    };
  }
  
  const allSlots: string[] = [];
  
  dayAvailability.timeRanges.forEach(range => {
    const slots = generateTimeSlots(range.start, range.end);
    allSlots.push(...slots);
  });
  
  const uniqueSlots = [...new Set(allSlots)].sort();
  
  return {
    ...dayAvailability,
    timeSlots: uniqueSlots
  };
}

export function processWeeklyAvailability(availability: any) {
  if (!availability) return null;
  
  const processed = { ...availability };
  
  Object.keys(processed).forEach(day => {
    const dayData = processed[day];
    if (dayData && dayData.isAvailable && dayData.timeRanges?.length > 0) {
      dayData.timeSlots = [];
      dayData.timeRanges.forEach(range => {
        const slots = generateTimeSlots(range.start, range.end);
        dayData.timeSlots.push(...slots);
      });
    } else if (dayData) {
      dayData.timeSlots = [];
    }
  });
  
  return processed;
}
