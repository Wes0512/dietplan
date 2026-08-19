import { describe, expect, it } from 'vitest';
import { copy } from '../i18n';
import { seedWorkouts } from '../data/workouts.seed';
import { plan14Day } from '../data/plan14day.seed';
import { generateCoachDecision, deriveWeeklyHighlights } from '../services/coachEngine';
import { generateCoachInsight } from '../services/progressEngine';
import type { WeekStats } from '../services/statsEngine';
import type { DailyLog, WeeklyReview } from '../types';

const CJK = /[\u4e00-\u9fff]/;

describe('Phase 6.5 localization — main navigation is Chinese', () => {
  it('nav labels are Chinese, not English', () => {
    expect(copy.nav.today).toBe('今天');
    expect(copy.nav.plan).toBe('计划');
    expect(copy.nav.progress).toBe('进展');
    expect(copy.nav.coach).toBe('教练');
    for (const label of Object.values(copy.nav)) {
      expect(label).toMatch(CJK);
    }
  });
});

describe('Phase 6.5 localization — page titles/subtitles are Chinese', () => {
  it('Plan / Progress / Coach page titles are Chinese', () => {
    expect(copy.plan.title).toMatch(CJK);
    expect(copy.progress.title).toMatch(CJK);
    expect(copy.coach.title).toMatch(CJK);
  });
});

describe('Phase 6.5 localization — workout instructions are Chinese', () => {
  const allSteps = seedWorkouts.flatMap((w) => [w.warmup, ...w.exercises, w.cooldown]);

  it('every exercise field (why/start_position/movement/key_points/common_mistakes/stop_if) is Chinese', () => {
    for (const step of allSteps) {
      expect(step.why).toMatch(CJK);
      expect(step.start_position).toMatch(CJK);
      for (const m of step.movement_steps) expect(m).toMatch(CJK);
      for (const k of step.key_points) expect(k).toMatch(CJK);
      for (const m of step.common_mistakes) expect(m).toMatch(CJK);
      for (const s of step.stop_if) expect(s).toMatch(CJK);
    }
  });

  it('visual demo frame labels are Chinese', () => {
    for (const step of allSteps) {
      for (const frame of step.visual_demo?.frames ?? []) {
        expect(frame.label).toMatch(CJK);
      }
    }
  });

  it('workout names are Chinese ("训练 A" / "训练 B")', () => {
    for (const w of seedWorkouts) {
      expect(w.name).toMatch(CJK);
    }
  });
});

describe('Phase 6.5 localization — plan day content is Chinese', () => {
  it('every weekday_label and goal label is Chinese', () => {
    for (const day of plan14Day) {
      expect(day.weekday_label).toMatch(CJK);
      for (const goal of day.goals) {
        expect(goal.label).toMatch(CJK);
      }
      if (day.notes) expect(day.notes).toMatch(CJK);
    }
  });
});

describe('Phase 6.5 localization — safety instructions are Chinese', () => {
  it('safety copy is entirely Chinese', () => {
    expect(copy.safety.collapsedTitle).toMatch(CJK);
    expect(copy.safety.intro).toMatch(CJK);
    expect(copy.safety.greenDesc).toMatch(CJK);
    expect(copy.safety.yellowDesc).toMatch(CJK);
    expect(copy.safety.redDesc).toMatch(CJK);
    expect(copy.safety.footer).toMatch(CJK);
  });

  it('does not make medical diagnostic claims (no "确诊" or naming a specific condition)', () => {
    const allSafetyText = Object.values(copy.safety).join(' ');
    expect(allSafetyText).not.toMatch(/确诊|诊断为|你患有/);
  });
});

describe('Phase 6.5 localization — goal status labels are Chinese', () => {
  it('progress state labels are Chinese, internal enum values remain English', () => {
    expect(copy.goalStatus.notStarted).toBe('尚未开始');
    expect(copy.goalStatus.inProgress).toBe('进行中');
    expect(copy.goalStatus.almostThere).toBe('快完成了');
    expect(copy.goalStatus.completed).toBe('已完成');
  });

  it('consistency labels are Chinese and avoid judgmental words', () => {
    const banned = /失败|不合格|太差|做得不够/;
    for (const label of Object.values(copy.consistency)) {
      expect(label).toMatch(CJK);
      expect(label).not.toMatch(banned);
    }
  });
});

describe('Phase 6.5 localization — coach decision labels are Chinese, enum values unchanged', () => {
  it('coachDecision copy maps KEEP/ADJUST/PROGRESS/HOLD to Chinese text', () => {
    expect(copy.coachDecision.KEEP).toBe('维持');
    expect(copy.coachDecision.ADJUST).toBe('调整');
    expect(copy.coachDecision.PROGRESS).toBe('可以逐步增加');
    expect(copy.coachDecision.HOLD).toBe('先保持');
  });

  it('PROGRESS wording does not imply automatic progression', () => {
    expect(copy.coachDecision.PROGRESS).not.toMatch(/自动/);
  });
});

describe('Phase 6.5 localization — empty states and buttons are Chinese', () => {
  it('common button/empty-state copy is Chinese', () => {
    expect(copy.common.save).toBe('保存');
    expect(copy.common.saved).toContain('已保存');
    expect(copy.common.cancel).toBe('取消');
    expect(copy.common.noData).toBe('暂无记录');
    expect(copy.common.notEnoughData).toMatch(CJK);
  });
});

describe('Phase 7 localization — backup/restore UI is Chinese', () => {
  it('key backup terminology matches the requested Chinese terms', () => {
    expect(copy.backup.title).toBe('数据备份');
    expect(copy.backup.exportButton).toBe('导出备份');
    expect(copy.backup.chooseFile).toBe('选择备份文件');
    expect(copy.backup.dataCheck).toBe('数据检查');
    expect(copy.backup.appVersion).toBe('App 版本');
    expect(copy.backup.dataVersion).toBe('数据版本');
    expect(copy.backup.lastBackup).toBe('上次备份');
    expect(copy.backup.exportSuccess).toBe('备份已创建');
    expect(copy.backup.invalidFile).toBe('导入失败');
    expect(copy.backup.cancel).toBe('取消');
    expect(copy.backup.confirmImport).toBe('确认导入');
  });

  it('the "existing data will not be deleted" notice is present and in Chinese', () => {
    expect(copy.backup.importPreviewNoOverwrite).toMatch(CJK);
    expect(copy.backup.importPreviewNoOverwrite).toContain('不会被直接删除');
  });

  it('all parameterized backup copy functions produce Chinese output', () => {
    expect(copy.backup.importPreviewDailyLogs(14)).toBe('14 条每日记录');
    expect(copy.backup.importPreviewWorkoutSessions(3)).toBe('3 次训练记录');
    expect(copy.backup.importPreviewWeeklyReviews(1)).toBe('1 份每周复盘');
    expect(copy.backup.importSuccessSummary(5, 2, 1)).toMatch(CJK);
    expect(copy.backup.schemaNewerError(6, 5)).toMatch(CJK);
  });
});

describe('Phase 6.5 localization — coachEngine / progressEngine generated text is Chinese and judgment-free', () => {
  const goodStats: WeekStats = {
    average_weight_kg: 65.6, average_steps: 6800, average_water_ml: 2000,
    average_sleep_min: 400, average_energy: 3.5, exercise_completion: '2/2', pain_reported: false,
  };
  const banned = /失败|不合格|太差|做得不够|做得不好/;

  it('generateCoachDecision reason text is Chinese and judgment-free across branches', () => {
    const scenarios = [
      { week_number: 1, stats: { ...goodStats, pain_reported: true }, logs: [] as DailyLog[], is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 1, stats: { ...goodStats, exercise_completion: '0/2' }, logs: [] as DailyLog[], is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 1, stats: goodStats, logs: [] as DailyLog[], is_phase_boundary: false, required_workout_count: 2 },
      { week_number: 2, stats: goodStats, logs: [] as DailyLog[], is_phase_boundary: true, required_workout_count: 2 },
    ];
    for (const s of scenarios) {
      const result = generateCoachDecision(s);
      expect(result.reason).toMatch(CJK);
      expect(result.reason).not.toMatch(banned);
      for (const goal of result.next_week_goals) {
        expect(goal).not.toMatch(banned);
      }
    }
  });

  it('deriveWeeklyHighlights output is Chinese', () => {
    const review: WeeklyReview = {
      id: 'r', user_id: 'u', week_number: 1, average_steps: 6420, average_sleep_min: 375, average_energy: 2.8,
      exercise_completion: '2/2', pain_reported: false, coach_summary: 's', coach_decision: 'KEEP',
      coach_decision_reason: 'r', next_week_goal_1: 'a', next_week_goal_2: 'b', next_week_goal_3: 'c',
      created_at: '2026-08-23T21:00:00.000Z',
      updated_at: '2026-08-23T21:00:00.000Z',
    };
    const { wentWell, needsAttention } = deriveWeeklyHighlights(review);
    for (const line of [...wentWell, ...needsAttention]) {
      expect(line).toMatch(CJK);
    }
  });

  it('generateCoachInsight output is Chinese when generated', () => {
    const insight = generateCoachInsight({
      daysLogged: 7,
      movement: { avg_steps: 6800, steps_sample_days: 7, steps_target: 6500, workout_completed: 2, workout_required: 2, workout_consistency: 'on_track', low_impact_completed: 1, low_impact_planned: 1, low_impact_consistency: 'on_track' },
      recovery: { avg_sleep_min: 280, sleep_sample_days: 7, avg_energy: 3.5, energy_sample_days: 7, pain_days_count: 0, pain_area_counts: {}, days_logged: 7 },
      habits: { avg_water_ml: 1900, water_sample_days: 7, water_target_ml: 2000, lunch_walk_rate: 0.8, lunch_walk_consistency: 'on_track', avg_sitting_breaks: 3, sitting_breaks_sample_days: 7, sitting_breaks_target: 3, days_logged: 7 },
    });
    expect(insight).not.toBeNull();
    expect(insight).toMatch(CJK);
    expect(insight).not.toMatch(banned);
  });
});

describe('Phase 6.5 localization — internal identifiers remain unchanged', () => {
  it('CoachDecision enum values are still the English constants KEEP/ADJUST/PROGRESS/HOLD', () => {
    const result = generateCoachDecision({
      week_number: 1,
      stats: { average_steps: 6800, average_sleep_min: 400, average_energy: 3.5, exercise_completion: '2/2', pain_reported: false },
      logs: [],
      is_phase_boundary: false,
      required_workout_count: 2,
    });
    expect(['KEEP', 'ADJUST', 'PROGRESS', 'HOLD']).toContain(result.decision);
  });

  it('DailyLog/WorkoutSession field names used by the app are still English snake_case (spot check via type usage)', () => {
    const log: DailyLog = {
      id: 'x', user_id: 'u', date: '2026-08-17', water_ml: 0, sitting_breaks: 0,
      exercise_completed: false, lunch_walk_done: false, shoulder_relax_done: false, stretch_done: false,
      updated_at: '2026-08-17T00:00:00.000Z',
    };
    expect(Object.keys(log)).toContain('lunch_walk_done');
    expect(Object.keys(log)).toContain('exercise_completed');
  });
});
