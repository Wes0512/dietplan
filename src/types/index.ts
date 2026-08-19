// =========================================================
// Personal Fat Loss Coach App — Core Data Types
// Phase 1: Data Model
// schemaVersion: 1
// =========================================================

/** 目标要求等级（调整点 #4：Required vs Optional goals） */
export type GoalRequirement =
  | 'required'      // 当天必须完成，未完成会在 UI 上明确标出（不能出现在 rest day）
  | 'target'        // 有具体数字目标，但不是严格 pass/fail（如 steps, water）
  | 'recommended'   // 建议做，但不强制、不会因未完成产生"失败"提示
  | 'optional'      // 完全可选
  | 'not_applicable'; // 当天根本不适用，UI 不应显示这个目标

export type PainArea =
  | 'lower_back'
  | 'foot'
  | 'knee'
  | 'shoulder_neck'
  | 'other';

export type ExerciseFeeling = 'comfortable' | 'tired' | 'uncomfortable';

export type PortionSize = 'small' | 'normal' | 'large';
export type QualityLevel = 'low' | 'enough';
export type SnackLevel = 'none' | 'small' | 'high';
export type DrinkType = 'water' | 'sugar_free' | 'sugary';

// ---------------------------------------------------------
// USER
// ---------------------------------------------------------
export interface User {
  /** 稳定 UUID。prototype 阶段单用户，但字段结构已按多用户设计，
   *  未来迁移 Supabase 时可直接作为 auth.uid() 外键使用，无需重构表结构。 */
  id: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height_cm: number;
  starting_weight_kg: number;
  target_weight_kg: number;
  baseline_steps: number;
  /** 14 天计划的起始日期 'YYYY-MM-DD'。与 created_at（账号创建时间）分开，
   *  因为用户理论上可以稍后才正式开始计划（虽然 Phase 3 暂不做"延后开始"UI）。 */
  program_start_date: string;
  created_at: string; // ISO datetime
}

// ---------------------------------------------------------
// DAILY_LOG
// ---------------------------------------------------------
export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // 'YYYY-MM-DD', 与 user_id 组成复合唯一索引

  weight_kg?: number;
  steps?: number;
  water_ml: number; // 默认 0，通过 +250/+500/+750 按钮累加

  sleep_start?: string; // 'HH:mm'
  sleep_end?: string;   // 'HH:mm'
  sleep_duration_min?: number; // 派生值，保存时一并计算，避免每次显示都重算

  afternoon_energy?: 1 | 2 | 3 | 4 | 5;

  breakfast_portion?: PortionSize;
  lunch_portion?: PortionSize;
  dinner_portion?: PortionSize;
  protein?: QualityLevel;
  vegetables?: QualityLevel;
  snacks?: SnackLevel;
  drinks?: DrinkType[];

  sitting_breaks: number; // 当天点击 "Done" 的次数（0-3+）

  exercise_completed: boolean;
  exercise_type?: string; // 'workout_a' | 'workout_b' | 'low_impact_activity' | 'rest'
  exercise_feeling?: ExerciseFeeling;
  pain_area?: PainArea[];

  /** schema v2 新增：替代原本借用 notes 文本关键字判断完成的临时方案 */
  lunch_walk_done: boolean;
  shoulder_relax_done: boolean;
  stretch_done: boolean;

  notes?: string;
  updated_at: string; // ISO datetime，每次保存更新
}

// ---------------------------------------------------------
// 动作教学内容（调整点 #1：In-app visual teaching，不依赖外部视频）
// ---------------------------------------------------------
export interface VisualDemoFrame {
  /** 帧的简短标签，例如 'Start' / 'Mid-movement' / 'End' */
  label: string;
  /** 指向 app 内本地 SVG 资源路径，不依赖外部网络，保证离线可用 */
  asset_path: string;
  alt_text: string;
}

export interface VisualDemo {
  type: 'illustration' | 'animation_gif' | 'diagram';
  /** 1-3 帧，按顺序展示 Start Position → Movement → End Position */
  frames: VisualDemoFrame[];
}

export interface ExternalVideoRef {
  url: string;
  source_name: string; // 例如 'NHS', 'Physiotherapy Clinic XYZ'
  /** 恒为 true：明确标记为"补充"，UI 上必须弱化展示（次要按钮），
   *  不能替代 in-app 教学内容 */
  is_supplementary: true;
}

export interface ExerciseStep {
  id: string;
  name_en: string;
  /** 面向完全新手的显示名称，中英夹杂，避免专业术语 */
  name_display: string;
  why: string;
  start_position: string;
  /** 分步骤数组，UI 逐条展示，而不是一大段文字 */
  movement_steps: string[];
  reps_or_duration: string;
  key_points: string[];
  common_mistakes: string[];
  /** 该动作专属的停止信号（叠加在全局 Safety Rules 之上） */
  stop_if: string[];
  visual_demo?: VisualDemo;
  external_video?: ExternalVideoRef;
}

// ---------------------------------------------------------
// WORKOUT
// ---------------------------------------------------------
export interface Workout {
  id: string;
  name: string; // 'Workout A'
  description: string;
  duration_min_range: [number, number]; // e.g. [15, 20]
  level: 'beginner';
  warmup: ExerciseStep;
  exercises: ExerciseStep[];
  cooldown: ExerciseStep;
  safety_notes: string;
}

// ---------------------------------------------------------
// WORKOUT_SESSION
// ---------------------------------------------------------
export interface WorkoutSession {
  id: string;
  user_id: string;
  /** performed_date：实际完成训练的那一天，可能不等于计划安排的那一天（允许补做/提前做） */
  date: string;
  workout_id: string;
  /** schema v4 新增：这次训练对应 14 天计划里的第几天（例如 Day 1 的 Workout A
   *  在 Day 2 才补做，这里记录 1，date 记录补做当天的日期）。
   *  可选：不是每次训练都必须绑定到某个计划日（未来可能有"额外训练"场景）。 */
  planned_day_number?: number;
  completed: boolean;
  feeling?: ExerciseFeeling;
  pain_area?: PainArea[];
  notes?: string;
  created_at: string;
}

// ---------------------------------------------------------
// 每日目标定义（调整点 #3 + #4）
// ---------------------------------------------------------
export interface DailyGoalDefinition {
  key: string; // 'steps' | 'water' | 'workout' | 'lunch_walk' | 'sitting_breaks' | 'sleep_track' | 'recovery_walk' | 'movement_break'
  label: string; // UI 显示文案，如 "Steps ~6,500"
  requirement: GoalRequirement;
  target_value?: number | string;
}

/** Today 页面渐进式状态：用于数量型目标（步数/水），不产生"失败"标签 */
export type ProgressState = 'not_started' | 'in_progress' | 'almost_there' | 'completed';

/** 运行时计算结果，不落库；由 DailyLog + DailyGoalDefinition 推导而来 */
export interface DailyGoalStatus extends DailyGoalDefinition {
  completed: boolean;
  /** 仅数量型目标（如 steps/water）会有值；required 类的二元目标此字段为 undefined，
   *  UI 直接用 completed 渲染"完成/未完成"，不套用渐进状态文案。 */
  progress_state?: ProgressState;
  current_value?: number;
}

// ---------------------------------------------------------
// 14-Day Plan
// ---------------------------------------------------------
export interface DayPlan {
  day_number: number; // 1-14
  week_number: 1 | 2;
  day_type: 'workout' | 'recovery' | 'rest' | 'low_impact' | 'full_review';
  workout_id?: string; // 仅 day_type === 'workout' 时有值
  goals: DailyGoalDefinition[];
  notes?: string;
}

// ---------------------------------------------------------
// WEEKLY_REVIEW（调整点 #5：coach_decision）
// ---------------------------------------------------------
export type CoachDecision = 'KEEP' | 'ADJUST' | 'PROGRESS' | 'HOLD';

export interface WeeklyReview {
  id: string;
  user_id: string;
  week_number: number;

  average_weight_kg?: number;
  average_steps?: number;
  average_water_ml?: number;
  average_sleep_min?: number;
  exercise_completion: string; // '2/2'
  average_energy?: number;
  pain_reported: boolean;

  coach_summary: string;

  /** 教练本周决策 */
  coach_decision: CoachDecision;
  /** 决策理由，必须是人类可读的完整句子，不能只是枚举值 */
  coach_decision_reason: string;

  next_week_goal_1: string;
  next_week_goal_2: string;
  next_week_goal_3: string;

  created_at: string;
  /** Phase 7：用于跨设备导入时判断"哪一份更新"，每次保存（含重新生成）都会更新 */
  updated_at: string;
}

// ---------------------------------------------------------
// APP_CONFIG
// ---------------------------------------------------------
export interface AppConfig {
  id: 'singleton'; // 固定主键，全表只有一条记录
  schema_version: number;
  app_version: string;
  /** Phase 7：上次导出备份的时间，Backup 页面展示"上次备份"用 */
  last_export_at?: string;
}
