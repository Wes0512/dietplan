// =========================================================
// GoalList — Today 页面的目标展示（Phase 3）
// required/target 二元项 vs 数量型 progressive 项分开渲染，
// 数量型目标绝不显示 "Failed"
// =========================================================
import type { DailyGoalStatus, ProgressState } from '../types';
import { copy } from '../i18n';

const PROGRESS_LABEL: Record<ProgressState, string> = {
  not_started: copy.goalStatus.notStarted,
  in_progress: copy.goalStatus.inProgress,
  almost_there: copy.goalStatus.almostThere,
  completed: copy.goalStatus.completed,
};

const PROGRESS_COLOR: Record<ProgressState, string> = {
  not_started: 'bg-gray-200',
  in_progress: 'bg-amber-300',
  almost_there: 'bg-amber-400',
  completed: 'bg-green-500',
};

function ProgressiveGoalRow({ goal }: { goal: DailyGoalStatus }) {
  const state = goal.progress_state ?? 'not_started';
  const target = Number(goal.target_value ?? 0);
  const current = goal.current_value ?? 0;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <li className="py-2">
      <div className="flex items-center justify-between text-sm">
        <span>{goal.label}</span>
        <span className="text-gray-500">
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${PROGRESS_COLOR[state]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-500">{PROGRESS_LABEL[state]}</div>
    </li>
  );
}

function BinaryGoalRow({ goal }: { goal: DailyGoalStatus }) {
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <span>{goal.completed ? '☑' : '☐'}</span>
      <span>{goal.label}</span>
    </li>
  );
}

export function GoalList({ goals, muted = false }: { goals: DailyGoalStatus[]; muted?: boolean }) {
  if (goals.length === 0) return null;
  return (
    <ul className={`divide-y ${muted ? 'text-gray-500' : ''}`}>
      {goals.map((g) =>
        g.progress_state !== undefined ? (
          <ProgressiveGoalRow key={g.key} goal={g} />
        ) : (
          <BinaryGoalRow key={g.key} goal={g} />
        ),
      )}
    </ul>
  );
}
