/**
 * Focus Timer Service (Pomodoro Technique)
 *
 * Provides a complete Pomodoro timer implementation with:
 * - Work sessions (default 25 min)
 * - Short breaks (default 5 min)
 * - Long breaks (default 15 min after 4 sessions)
 * - Auto-start next session option
 * - Task association
 * - Session history tracking
 * - Sound notifications
 */

import { supabase } from "@/utils/supabase";
import type { FocusSession, FocusSessionType, FocusSessionStatus, UserPreferences } from "@/types/tasks";

// ============================================
// Types
// ============================================

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSession: FocusSession | null;
  sessionType: FocusSessionType;
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
  sessionNumber: number; // 1-4 for work sessions
  taskId: string | null;
  taskTitle: string | null;
}

export interface TimerSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

type TimerEventType =
  | 'tick'
  | 'start'
  | 'pause'
  | 'resume'
  | 'complete'
  | 'interrupt'
  | 'skip'
  | 'reset'
  | 'session-change';

type TimerEventListener = (state: TimerState) => void;

// Default settings
const DEFAULT_SETTINGS: TimerSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  vibrationEnabled: true,
};

// ============================================
// Focus Timer Service Class
// ============================================

class FocusTimerService {
  private state: TimerState;
  private settings: TimerSettings;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<TimerEventType, Set<TimerEventListener>> = new Map();
  private userId: string | null = null;
  private audioContext: AudioContext | null = null;
  private startTime: Date | null = null;

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.state = this.getInitialState();
    this.initAudio();
  }

  // ============================================
  // Initialization
  // ============================================

  private getInitialState(): TimerState {
    return {
      isRunning: false,
      isPaused: false,
      currentSession: null,
      sessionType: 'work',
      timeRemaining: this.settings.workMinutes * 60,
      totalTime: this.settings.workMinutes * 60,
      sessionNumber: 1,
      taskId: null,
      taskTitle: null,
    };
  }

  private initAudio(): void {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      try {
        this.audioContext = new AudioContext();
      } catch (e) {
        console.warn('Could not initialize AudioContext:', e);
      }
    }
  }

  /**
   * Initialize the service with user data
   */
  async initialize(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.userId = user.id;
      await this.loadSettings();
      await this.checkForActiveSession();
    }
  }

  /**
   * Load user's timer settings from preferences
   */
  async loadSettings(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('pomodoro_work_minutes, pomodoro_short_break_minutes, pomodoro_long_break_minutes, pomodoro_sessions_before_long_break, notification_sound_enabled, notification_vibration_enabled')
        .eq('user_id', this.userId)
        .single();

      if (data) {
        this.settings = {
          ...this.settings,
          workMinutes: data.pomodoro_work_minutes || DEFAULT_SETTINGS.workMinutes,
          shortBreakMinutes: data.pomodoro_short_break_minutes || DEFAULT_SETTINGS.shortBreakMinutes,
          longBreakMinutes: data.pomodoro_long_break_minutes || DEFAULT_SETTINGS.longBreakMinutes,
          sessionsBeforeLongBreak: data.pomodoro_sessions_before_long_break || DEFAULT_SETTINGS.sessionsBeforeLongBreak,
          soundEnabled: data.notification_sound_enabled ?? DEFAULT_SETTINGS.soundEnabled,
          vibrationEnabled: data.notification_vibration_enabled ?? DEFAULT_SETTINGS.vibrationEnabled,
        };

        // Update state with new settings if not running
        if (!this.state.isRunning) {
          this.state.timeRemaining = this.getSessionDuration(this.state.sessionType);
          this.state.totalTime = this.state.timeRemaining;
        }
      }
    } catch (error) {
      console.error('Error loading timer settings:', error);
    }
  }

  /**
   * Check for any active (interrupted) session
   */
  private async checkForActiveSession(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', this.userId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1);

      // Handle errors gracefully
      if (error) {
        // Table doesn't exist or permission issue
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          console.warn('Focus sessions table not available yet. Run the database migration.');
          return;
        }
        console.warn('Error checking for active session:', error.message);
        return;
      }

      // No active sessions found - this is normal
      if (!data || data.length === 0) {
        return;
      }

      const session = data[0];
      if (session) {
        // Resume the session if it was started recently (within last hour)
        const startedAt = new Date(session.started_at);
        const now = new Date();
        const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 60000;

        if (elapsedMinutes < 60) {
          // Calculate remaining time
          const elapsedSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
          const totalSeconds = session.planned_duration_minutes * 60;
          const remaining = Math.max(0, totalSeconds - elapsedSeconds);

          if (remaining > 0) {
            this.state = {
              ...this.state,
              currentSession: session,
              sessionType: session.session_type,
              timeRemaining: remaining,
              totalTime: totalSeconds,
              sessionNumber: session.session_number,
              taskId: session.task_id,
              isPaused: true,
              isRunning: false,
            };
          }
        } else {
          // Mark old session as interrupted
          await this.markSessionInterrupted(session.id, 'Session expired');
        }
      }
    } catch (error) {
      // No active session, that's fine
    }
  }

  // ============================================
  // Timer Controls
  // ============================================

  /**
   * Start a new timer session
   */
  async start(taskId?: string, taskTitle?: string): Promise<void> {
    if (this.state.isRunning) return;

    this.userId = this.userId || (await supabase.auth.getUser()).data.user?.id || null;
    if (!this.userId) {
      console.error('No user logged in');
      return;
    }

    const duration = this.getSessionDuration(this.state.sessionType);
    this.startTime = new Date();

    // Create session record
    const session = await this.createSessionRecord(
      this.state.sessionType,
      Math.floor(duration / 60),
      taskId || null
    );

    this.state = {
      ...this.state,
      isRunning: true,
      isPaused: false,
      currentSession: session,
      timeRemaining: duration,
      totalTime: duration,
      taskId: taskId || null,
      taskTitle: taskTitle || null,
    };

    this.startInterval();
    this.emit('start', this.state);
  }

  /**
   * Pause the current session
   */
  pause(): void {
    if (!this.state.isRunning || this.state.isPaused) return;

    this.stopInterval();
    this.state.isPaused = true;
    this.state.isRunning = false;
    this.emit('pause', this.state);
  }

  /**
   * Resume a paused session
   */
  resume(): void {
    if (!this.state.isPaused) return;

    this.state.isPaused = false;
    this.state.isRunning = true;
    this.startInterval();
    this.emit('resume', this.state);
  }

  /**
   * Skip the current session
   */
  async skip(): Promise<void> {
    if (this.state.currentSession) {
      await this.updateSessionRecord(this.state.currentSession.id, {
        status: 'skipped',
        ended_at: new Date().toISOString(),
        actual_duration_minutes: Math.floor((this.state.totalTime - this.state.timeRemaining) / 60),
      });
    }

    this.stopInterval();
    this.emit('skip', this.state);
    this.moveToNextSession();
  }

  /**
   * Stop and reset the timer
   */
  async reset(): Promise<void> {
    if (this.state.currentSession && this.state.isRunning) {
      await this.markSessionInterrupted(this.state.currentSession.id, 'User reset');
    }

    this.stopInterval();
    this.state = this.getInitialState();
    this.emit('reset', this.state);
  }

  /**
   * Interrupt the current session
   */
  async interrupt(reason?: string): Promise<void> {
    if (this.state.currentSession) {
      await this.markSessionInterrupted(this.state.currentSession.id, reason || 'Interrupted by user');
    }

    this.stopInterval();
    this.emit('interrupt', this.state);
    this.state = {
      ...this.getInitialState(),
      sessionNumber: this.state.sessionNumber,
      taskId: this.state.taskId,
      taskTitle: this.state.taskTitle,
    };
  }

  /**
   * Set the task for the timer
   */
  setTask(taskId: string | null, taskTitle: string | null): void {
    this.state.taskId = taskId;
    this.state.taskTitle = taskTitle;
  }

  /**
   * Switch to a specific session type
   */
  switchTo(sessionType: FocusSessionType): void {
    if (this.state.isRunning) {
      console.warn('Cannot switch session type while running');
      return;
    }

    const duration = this.getSessionDuration(sessionType);
    this.state = {
      ...this.state,
      sessionType,
      timeRemaining: duration,
      totalTime: duration,
    };
    this.emit('session-change', this.state);
  }

  // ============================================
  // Private Timer Methods
  // ============================================

  private startInterval(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick(): void {
    if (!this.state.isRunning) return;

    this.state.timeRemaining--;
    this.emit('tick', this.state);

    if (this.state.timeRemaining <= 0) {
      this.completeSession();
    }
  }

  private async completeSession(): Promise<void> {
    this.stopInterval();

    // Play completion sound
    if (this.settings.soundEnabled) {
      this.playCompletionSound();
    }

    // Vibrate if enabled
    if (this.settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    // Update session record
    if (this.state.currentSession) {
      const actualMinutes = Math.floor(this.state.totalTime / 60);
      await this.updateSessionRecord(this.state.currentSession.id, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        actual_duration_minutes: actualMinutes,
      });

      // If this was a work session linked to a task, update task time
      if (this.state.sessionType === 'work' && this.state.taskId) {
        await this.addTimeToTask(this.state.taskId, actualMinutes);
      }
    }

    this.state.isRunning = false;
    this.emit('complete', this.state);

    // Move to next session
    this.moveToNextSession();

    // Auto-start next session if enabled
    if (
      (this.state.sessionType !== 'work' && this.settings.autoStartWork) ||
      (this.state.sessionType === 'work' && this.settings.autoStartBreaks)
    ) {
      setTimeout(() => {
        if (!this.state.isRunning) {
          this.start(this.state.taskId || undefined, this.state.taskTitle || undefined);
        }
      }, 3000); // 3 second delay before auto-start
    }
  }

  private moveToNextSession(): void {
    let nextType: FocusSessionType;
    let nextSessionNumber = this.state.sessionNumber;

    if (this.state.sessionType === 'work') {
      // After work, take a break
      if (this.state.sessionNumber >= this.settings.sessionsBeforeLongBreak) {
        nextType = 'long_break';
        nextSessionNumber = 1; // Reset session count after long break
      } else {
        nextType = 'short_break';
        nextSessionNumber = this.state.sessionNumber + 1;
      }
    } else {
      // After break, work
      nextType = 'work';
      if (this.state.sessionType === 'long_break') {
        nextSessionNumber = 1;
      }
    }

    const duration = this.getSessionDuration(nextType);
    this.state = {
      ...this.state,
      isRunning: false,
      isPaused: false,
      currentSession: null,
      sessionType: nextType,
      timeRemaining: duration,
      totalTime: duration,
      sessionNumber: nextSessionNumber,
    };

    this.emit('session-change', this.state);
  }

  private getSessionDuration(type: FocusSessionType): number {
    switch (type) {
      case 'work':
        return this.settings.workMinutes * 60;
      case 'short_break':
        return this.settings.shortBreakMinutes * 60;
      case 'long_break':
        return this.settings.longBreakMinutes * 60;
      default:
        return this.settings.workMinutes * 60;
    }
  }

  // ============================================
  // Database Operations
  // ============================================

  private async createSessionRecord(
    sessionType: FocusSessionType,
    plannedMinutes: number,
    taskId: string | null
  ): Promise<FocusSession | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert({
          user_id: this.userId,
          task_id: taskId,
          session_type: sessionType,
          planned_duration_minutes: plannedMinutes,
          started_at: new Date().toISOString(),
          status: 'in_progress',
          session_number: this.state.sessionNumber,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating focus session:', error);
      return null;
    }
  }

  private async updateSessionRecord(
    sessionId: string,
    updates: Partial<FocusSession>
  ): Promise<void> {
    try {
      await supabase
        .from('focus_sessions')
        .update(updates)
        .eq('id', sessionId);
    } catch (error) {
      console.error('Error updating focus session:', error);
    }
  }

  private async markSessionInterrupted(sessionId: string, reason: string): Promise<void> {
    const actualMinutes = Math.floor((this.state.totalTime - this.state.timeRemaining) / 60);
    await this.updateSessionRecord(sessionId, {
      status: 'interrupted',
      ended_at: new Date().toISOString(),
      actual_duration_minutes: actualMinutes,
      interruption_reason: reason,
    });
  }

  private async addTimeToTask(taskId: string, minutes: number): Promise<void> {
    if (!this.userId) return;

    try {
      // Create time entry
      await supabase.from('task_time_entries').insert({
        task_id: taskId,
        user_id: this.userId,
        started_at: this.startTime?.toISOString() || new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_minutes: minutes,
        is_pomodoro: true,
        pomodoro_type: 'work',
      });
    } catch (error) {
      console.error('Error adding time to task:', error);
    }
  }

  // ============================================
  // Sound
  // ============================================

  private playCompletionSound(): void {
    if (!this.audioContext) return;

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      // Create a pleasant completion chime
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);

      // Second tone
      setTimeout(() => {
        if (!this.audioContext) return;
        const osc2 = this.audioContext.createOscillator();
        const gain2 = this.audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(this.audioContext.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        osc2.start(this.audioContext.currentTime);
        osc2.stop(this.audioContext.currentTime + 0.5);
      }, 200);
    } catch (e) {
      console.warn('Could not play completion sound:', e);
    }
  }

  // ============================================
  // Event System
  // ============================================

  on(event: TimerEventType, listener: TimerEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: TimerEventType, state: TimerState): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error(`Error in timer event listener for "${event}":`, error);
      }
    });
  }

  // ============================================
  // Getters
  // ============================================

  getState(): TimerState {
    return { ...this.state };
  }

  getSettings(): TimerSettings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<TimerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    // Update time remaining if not running
    if (!this.state.isRunning && !this.state.isPaused) {
      const duration = this.getSessionDuration(this.state.sessionType);
      this.state.timeRemaining = duration;
      this.state.totalTime = duration;
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getProgress(): number {
    if (this.state.totalTime === 0) return 0;
    return ((this.state.totalTime - this.state.timeRemaining) / this.state.totalTime) * 100;
  }

  // ============================================
  // Statistics
  // ============================================

  async getTodayStats(): Promise<{ sessions: number; minutes: number }> {
    if (!this.userId) return { sessions: 0, minutes: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const { data } = await supabase
        .from('focus_sessions')
        .select('actual_duration_minutes, status')
        .eq('user_id', this.userId)
        .eq('session_type', 'work')
        .eq('status', 'completed')
        .gte('started_at', today.toISOString());

      if (!data) return { sessions: 0, minutes: 0 };

      const sessions = data.length;
      const minutes = data.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0);

      return { sessions, minutes };
    } catch (error) {
      console.error('Error getting today stats:', error);
      return { sessions: 0, minutes: 0 };
    }
  }

  async getWeekStats(): Promise<{ sessions: number; minutes: number; byDay: Record<string, number> }> {
    if (!this.userId) return { sessions: 0, minutes: 0, byDay: {} };

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    try {
      const { data } = await supabase
        .from('focus_sessions')
        .select('actual_duration_minutes, started_at, status')
        .eq('user_id', this.userId)
        .eq('session_type', 'work')
        .eq('status', 'completed')
        .gte('started_at', weekAgo.toISOString());

      if (!data) return { sessions: 0, minutes: 0, byDay: {} };

      const sessions = data.length;
      const minutes = data.reduce((sum, s) => sum + (s.actual_duration_minutes || 0), 0);

      // Group by day
      const byDay: Record<string, number> = {};
      data.forEach((s) => {
        const day = new Date(s.started_at).toISOString().split('T')[0];
        byDay[day] = (byDay[day] || 0) + (s.actual_duration_minutes || 0);
      });

      return { sessions, minutes, byDay };
    } catch (error) {
      console.error('Error getting week stats:', error);
      return { sessions: 0, minutes: 0, byDay: {} };
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const focusTimerService = new FocusTimerService();

// Helper exports
export const initFocusTimer = () => focusTimerService.initialize();
export const startFocusTimer = (taskId?: string, taskTitle?: string) =>
  focusTimerService.start(taskId, taskTitle);
export const pauseFocusTimer = () => focusTimerService.pause();
export const resumeFocusTimer = () => focusTimerService.resume();
export const resetFocusTimer = () => focusTimerService.reset();
export const skipFocusSession = () => focusTimerService.skip();
export const getFocusTimerState = () => focusTimerService.getState();

export default focusTimerService;
