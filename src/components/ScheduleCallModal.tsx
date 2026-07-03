'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Clock, Phone, User, X, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { captureAnalyticsEvent } from '@/utils/analytics';
import { toValidUUID } from '@/store/utils';

interface ScheduleCallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Fixed list of typical daytime slot times (HH:mm format)
const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function ScheduleCallModal({ isOpen, onClose }: ScheduleCallModalProps) {
  const { onboardingProfile, userName, sessionId, activeChatId } = useChatStore();

  // Form states
  const [formName, setFormName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Dropdown calendar visibility
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Calendar displayed month state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Determine if profile fields are already verified/prefilled
  const isNameDisabled = !!(userName || onboardingProfile?.name);
  const isPhoneDisabled = !!onboardingProfile?.phone_number;

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Populate fields when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormName(userName || onboardingProfile?.name || '');
      setMobileNumber(onboardingProfile?.phone_number || '');
      setSelectedDate('');
      setSelectedTime('');
      setCurrentMonth(new Date());
      setShowCalendar(false);
      setErrorMsg(null);
      setSuccess(false);
    }
  }, [isOpen, userName, onboardingProfile]);

  if (!isOpen) return null;

  // Today string for time checks
  const todayDateObj = new Date();
  const todayStr = todayDateObj.toISOString().split('T')[0];

  // Helper to check if a specific time slot is in the past for today
  const isTimeSlotInPast = (timeStr: string) => {
    if (selectedDate !== todayStr) return false;
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    if (hours < currentHours) return true;
    if (hours === currentHours && minutes <= currentMinutes) return true;
    
    return false;
  };

  // Calendar Calculations
  const viewYear = currentMonth.getFullYear();
  const viewMonth = currentMonth.getMonth();

  // Get total days in month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Get starting day index of week (0 = Sunday, 6 = Saturday)
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  // Previous month offset days
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();

  const calendarCells = [];

  // Add trailing days of previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false
    });
  }

  // Add days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true
    });
  }

  // Add leading days of next month to complete 6-row calendar grid (42 cells)
  const remaining = 42 - calendarCells.length;
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;

  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false
    });
  }

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(viewYear, viewMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(viewYear, viewMonth + 1, 1));
  };

  // Check if prev button should be disabled (cannot go to past months)
  const isPrevMonthDisabled = 
    viewYear < todayDateObj.getFullYear() || 
    (viewYear === todayDateObj.getFullYear() && viewMonth <= todayDateObj.getMonth());

  // Date selection handler
  const handleDateSelect = (cellYear: number, cellMonth: number, cellDay: number) => {
    const formattedDate = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cellDay).padStart(2, '0')}`;
    setSelectedDate(formattedDate);
    setSelectedTime(''); // Reset selected time on date change
    setShowCalendar(false); // Close calendar dropdown

    // Simulate fetching slots with a smooth loader
    setIsLoadingSlots(true);
    setTimeout(() => {
      setIsLoadingSlots(false);
    }, 450);
  };

  // Helper to format selected date for human display
  const getReadableSelectedDate = () => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation checks
    if (!mobileNumber.trim()) {
      setErrorMsg('Mobile number is required.');
      return;
    }
    if (!selectedDate) {
      setErrorMsg('Please select a booking date.');
      return;
    }
    if (!selectedTime) {
      setErrorMsg('Please select a time slot.');
      return;
    }

    // Phone number validation: must be a valid 10-digit number
    const cleanPhone = mobileNumber.replace(/[\s\-\+\(\)]/g, '');
    const normalizedPhone = /^(91|0)/.test(cleanPhone) && cleanPhone.length > 10
      ? cleanPhone.replace(/^(91|0)/, '')
      : cleanPhone;

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      setErrorMsg('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSubmitting(true);
    captureAnalyticsEvent('schedule_call_attempt', { date: selectedDate, time: selectedTime });

    const rawSessionId = sessionId || activeChatId || (typeof window !== 'undefined' ? localStorage.getItem('yhealth_active_chat_id') : null) || '';

    // If name or mobile wasn't prefilled/submitted yet, pre-register the lead first so the backend has it
    if (!isNameDisabled || !isPhoneDisabled) {
      try {
        await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
          },
          body: JSON.stringify({
            session_id: toValidUUID(rawSessionId),
            name: formName.trim() || 'Guest User',
            phone_number: normalizedPhone,
            consent: true,
            lead_status: 'New',
            health_goal: onboardingProfile?.health_goal || 'General wellness',
            additional_details: {
              conditions: onboardingProfile?.conditions || [],
              feeling_note: onboardingProfile?.feeling_note || '',
            },
          }),
        });
      } catch (err) {
        console.warn('Failed to pre-register lead before scheduling:', err);
      }
    }

    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sessionId: rawSessionId,
          date: selectedDate,
          time: selectedTime,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        captureAnalyticsEvent('schedule_call_success', { date: selectedDate, time: selectedTime });
      } else {
        // Handle backend duplicate or custom validation errors
        const errorText = data?.detail || data?.message || 'The selected slot is already booked or unavailable. Please choose another date/time.';
        setErrorMsg(errorText);
        captureAnalyticsEvent('schedule_call_failed', { reason: errorText });
      }
    } catch (err) {
      console.error('Failed to book schedule call:', err);
      setErrorMsg('Could not connect to the scheduling service. Please check your network connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = mobileNumber.trim().length > 0 && selectedDate !== '' && selectedTime !== '';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 animate-fade-in">
      <form
        onSubmit={handleBookingSubmit}
        className="w-full sm:max-w-md bg-white dark:bg-[#0e0e0e] border-t sm:border border-neutral-100 dark:border-white/10 rounded-t-[32px] sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden"
      >
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto mt-3 block sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <CalendarIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#111111] dark:text-white leading-tight">Schedule Call</h3>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">With YHealth Expert</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          /* SUCCESS STATE */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-scale-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h4 className="text-lg font-black text-neutral-800 dark:text-white mb-2">Booking Confirmed!</h4>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-[320px]">
              Your call with YHealth has been scheduled successfully. Our team will contact you at the selected time.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-[#111111] dark:bg-white hover:bg-black dark:hover:bg-neutral-100 text-white dark:text-black text-xs font-bold rounded-2xl transition shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
            >
              Back to Chat
            </button>
          </div>
        ) : (
          /* FORM STATE */
          <>
            {/* Scrollable Fields area */}
            <div className={`flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar transition-all duration-300 ${showCalendar ? 'pb-[280px]' : 'pb-6'}`}>
              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-50/95 dark:bg-red-950/40 border border-red-200/80 dark:border-red-500/20 rounded-2xl text-xs text-red-600 dark:text-red-400 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Name Field */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider pl-1">
                    Your Name (Optional)
                  </label>
                  {isNameDisabled && (
                    <span className="text-[9px] text-emerald-500 dark:text-emerald-400 font-bold ml-1.5 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Prefilled
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Vishal Kumar"
                    disabled={isNameDisabled}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-neutral-100/50 dark:disabled:bg-white/[0.04]"
                  />
                </div>
              </div>

              {/* Mobile Number Field */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center">
                  <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider pl-1">
                    Mobile Number <span className="text-red-500 font-bold">*</span>
                  </label>
                  {isPhoneDisabled && (
                    <span className="text-[9px] text-emerald-500 dark:text-emerald-400 font-bold ml-1.5 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Prefilled
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="9876543210"
                    disabled={isPhoneDisabled}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-neutral-100/50 dark:disabled:bg-white/[0.04]"
                  />
                </div>
              </div>

              {/* Custom Overlay/Dropdown Calendar Field */}
              <div className="flex flex-col gap-1 relative" ref={calendarRef}>
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider pl-1 mb-1">
                  Select Date <span className="text-red-500 font-bold">*</span>
                </label>
                
                <button
                  type="button"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarIcon className="w-4 h-4 text-neutral-400 shrink-0" />
                    <span className={selectedDate ? 'text-neutral-800 dark:text-neutral-200 font-semibold' : 'text-neutral-400'}>
                      {selectedDate ? getReadableSelectedDate() : 'Choose a date'}
                    </span>
                  </div>
                </button>

                {showCalendar && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-[#121212] border border-black/10 dark:border-white/10 rounded-2xl p-4 shadow-xl animate-scale-up">
                    {/* Month Swapper Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black text-neutral-800 dark:text-neutral-200">
                        {currentMonth.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isPrevMonthDisabled}
                          onClick={handlePrevMonth}
                          className="p-1 rounded-lg border border-black/5 dark:border-white/10 bg-white dark:bg-black/20 hover:bg-neutral-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 rounded-lg border border-black/5 dark:border-white/10 bg-white dark:bg-black/20 hover:bg-neutral-100 dark:hover:bg-white/5 transition"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Weekday Titles Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center font-bold text-[9px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                      {WEEKDAYS.map((day) => (
                        <span key={day} className="h-6 flex items-center justify-center">
                          {day}
                        </span>
                      ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {calendarCells.map((cell, idx) => {
                        const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
                        const isSelected = selectedDate === cellDateStr;

                        // Disable check: past dates
                        const cellDate = new Date(cell.year, cell.month, cell.day);
                        const todayCompare = new Date();
                        todayCompare.setHours(0, 0, 0, 0);
                        const isPast = cellDate < todayCompare;

                        // Enable check: is it in current displayed month
                        const isCurrent = cell.isCurrentMonth;
                        const isDisabled = isPast || !isCurrent;

                        // Highlight for Today
                        const isToday = 
                          cell.day === todayDateObj.getDate() && 
                          cell.month === todayDateObj.getMonth() && 
                          cell.year === todayDateObj.getFullYear();

                        return (
                          <button
                            key={`${cellDateStr}-${idx}`}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleDateSelect(cell.year, cell.month, cell.day)}
                            className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all relative cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-md'
                                : isDisabled
                                  ? 'text-neutral-200 dark:text-neutral-800 opacity-20 cursor-not-allowed'
                                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/5'
                            } ${
                              isToday && !isSelected
                                ? 'border border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : ''
                            }`}
                          >
                            {cell.day}
                            {isToday && isSelected && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-white" />
                            )}
                            {isToday && !isSelected && (
                              <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Time Slot Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider pl-1">
                  Select Time Slot <span className="text-red-500 font-bold">*</span>
                </label>
                
                {isLoadingSlots ? (
                  /* Slots Loading State */
                  <div className="flex items-center gap-2.5 p-4 bg-neutral-50 dark:bg-white/[0.02] border border-black/5 dark:border-white/10 rounded-2xl text-xs text-indigo-600 dark:text-indigo-400 justify-center mt-1">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span className="font-bold">Checking available time slots...</span>
                  </div>
                ) : selectedDate ? (
                  /* Slots Grid */
                  <div className="grid grid-cols-4 gap-2 mt-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar animate-fade-in">
                    {TIME_SLOTS.map((slot) => {
                      const isPast = isTimeSlotInPast(slot);
                      const isSelected = selectedTime === slot;

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isPast}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : isPast
                                ? 'bg-neutral-100 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-50'
                                : 'bg-black/5 dark:bg-white/5 border-transparent text-neutral-600 dark:text-neutral-300 hover:border-black/20 dark:hover:border-white/20'
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Date Unselected Placeholder */
                  <div className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10 rounded-2xl text-xs text-neutral-400 font-medium justify-center mt-1">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>Choose a date first to see available times</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer CTA */}
            <div className="p-6 border-t border-neutral-100 dark:border-white/[0.06] bg-white dark:bg-[#0e0e0e] shrink-0">
              <button
                type="submit"
                disabled={isSubmitting || !isFormValid}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-200 dark:disabled:bg-white/[0.05] text-white disabled:text-neutral-400 dark:disabled:text-neutral-600 text-xs font-black uppercase rounded-2xl transition shadow-md hover:shadow-lg active:scale-95 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scheduling Call...</span>
                  </>
                ) : (
                  <span>Schedule Call</span>
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
