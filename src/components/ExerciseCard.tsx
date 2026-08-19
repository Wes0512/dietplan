// =========================================================
// ExerciseCard — 完整的 in-app 动作教学 UI（Phase 4）
// 用户不需要离开 App 就能看懂怎么做这个动作。
// Phase 6.5：UI 文案改为简体中文
// =========================================================
import type { ExerciseStep } from '../types';
import { copy } from '../i18n';

export function ExerciseCard({ step }: { step: ExerciseStep }) {
  const c = copy.exercise;
  return (
    <div className="border rounded-xl p-4 mb-4">
      <h3 className="text-base font-semibold">{step.name_display}</h3>

      {/* Visual demonstration — 本地 SVG 插图，离线可用，起始→动作中→结束 多帧展示 */}
      {step.visual_demo && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {step.visual_demo.frames.map((frame) => (
            <div key={frame.asset_path} className="flex-shrink-0 w-32">
              <img
                src={frame.asset_path}
                alt={frame.alt_text}
                className="w-32 h-32 rounded-lg border bg-gray-50 object-contain"
              />
              <p className="text-xs text-center text-gray-500 mt-1">{frame.label}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-sm text-gray-600">
        <span className="font-medium text-gray-800">{c.why}：</span>
        {step.why}
      </p>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.startPosition}</p>
        <p className="text-sm mt-1">{step.start_position}</p>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.movement}</p>
        <ol className="mt-1 list-decimal list-inside text-sm space-y-1">
          {step.movement_steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>

      <div className="mt-3 text-sm">
        <span className="font-medium text-gray-800">{c.repsOrDuration}：</span>
        {step.reps_or_duration}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.keyPoints}</p>
        <ul className="mt-1 list-disc list-inside text-sm space-y-1">
          {step.key_points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{c.commonMistakes}</p>
        <ul className="mt-1 list-disc list-inside text-sm space-y-1 text-gray-600">
          {step.common_mistakes.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3 rounded-lg bg-red-50 border border-red-100 p-3">
        <p className="text-xs font-medium text-red-700 uppercase tracking-wide">{c.stopIf}</p>
        <ul className="mt-1 list-disc list-inside text-sm space-y-1 text-red-800">
          {step.stop_if.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>

      {step.external_video && (
        <a
          href={step.external_video.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-xs text-blue-600 underline"
        >
          {c.supplementaryVideo(step.external_video.source_name)}
        </a>
      )}
    </div>
  );
}
