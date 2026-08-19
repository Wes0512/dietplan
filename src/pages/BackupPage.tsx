// =========================================================
// Backup Page — Phase 7
// "App 更新或修改绝不能悄悄删除或覆盖用户的历史记录"
// 导出：一键下载 JSON 备份文件。
// 导入：选择文件 → 校验结构 → 校验版本 → 展示摘要 → 用户确认 → 事务导入 → 展示结果。
// 中途任何一步都不会提前写入数据库。
// =========================================================
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  buildImportSummary,
  exportAll,
  getAppInfo,
  getLastExportAt,
  performImport,
  recordExportTimestamp,
  type ImportResult,
  type ImportSummary,
} from '../repositories/backupRepo';
import { validateBackupFile, type BackupPayload } from '../services/backupValidation';
import { copy } from '../i18n';

const c = copy.backup;

type ImportStage =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'invalid'; error: string }
  | { step: 'ready'; payload: BackupPayload; summary: ImportSummary }
  | { step: 'importing'; payload: BackupPayload; summary: ImportSummary }
  | { step: 'success'; result: ImportResult }
  | { step: 'failed'; error: string };

export function BackupPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [appInfo, setAppInfo] = useState<{ app_version: string; schema_version: number } | undefined>();
  const [exporting, setExporting] = useState(false);
  const [exportedJustNow, setExportedJustNow] = useState(false);

  const [importStage, setImportStage] = useState<ImportStage>({ step: 'idle' });
  const [overwriteUserProfile, setOverwriteUserProfile] = useState(false);

  useEffect(() => {
    getLastExportAt().then(setLastBackup);
    getAppInfo().then(setAppInfo);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const payload = await exportAll();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coach-backup-${payload.exported_at.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await recordExportTimestamp();
      setLastBackup(await getLastExportAt());
      setExportedJustNow(true);
      setTimeout(() => setExportedJustNow(false), 2000);
    } finally {
      setExporting(false);
    }
  }

  function handleChooseFile() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许连续选择同一个文件也能触发 onChange
    if (!file) return;

    setImportStage({ step: 'checking' });
    setOverwriteUserProfile(false);

    let text: string;
    try {
      text = await file.text();
    } catch {
      setImportStage({ step: 'invalid', error: '无法读取所选文件，请确认它是有效的备份文件。' });
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setImportStage({ step: 'invalid', error: '文件内容不是有效的 JSON，可能已损坏或不是备份文件。' });
      return;
    }

    const validation = validateBackupFile(parsed);
    if (!validation.valid) {
      setImportStage({ step: 'invalid', error: validation.error });
      return;
    }

    const summary = await buildImportSummary(validation.payload);
    setImportStage({ step: 'ready', payload: validation.payload, summary });
  }

  function handleCancelImport() {
    setImportStage({ step: 'idle' });
  }

  async function handleConfirmImport() {
    if (importStage.step !== 'ready') return;
    const { payload, summary } = importStage;
    setImportStage({ step: 'importing', payload, summary });
    try {
      const result = await performImport(payload, { overwriteUserProfile });
      setImportStage({ step: 'success', result });
    } catch (err) {
      setImportStage({ step: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="pb-8">
      <div className="p-4 pb-2">
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600">
          {c.backToBackup}
        </button>
        <h1 className="text-xl font-semibold mt-2">{c.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{c.subtitle}</p>
      </div>

      {/* 导出 */}
      <div className="mx-4 mt-3 border rounded-xl p-4">
        <p className="text-sm font-semibold">{c.exportSection}</p>
        <p className="text-xs text-gray-500 mt-1">{c.exportHint}</p>
        <div className="mt-2 text-xs text-gray-500">
          <p>{c.lastBackup}：{lastBackup ? formatDateTime(lastBackup) : c.neverBackedUp}</p>
          {appInfo && (
            <p className="mt-0.5">
              {c.appVersion}：{appInfo.app_version} · {c.dataVersion}：v{appInfo.schema_version}
            </p>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 rounded-md bg-black text-white text-sm px-4 py-2 disabled:opacity-50"
        >
          {exporting ? '…' : c.exportButton}
        </button>
        {exportedJustNow && <span className="ml-2 text-xs text-green-600">{c.exportSuccess} ✓</span>}

        {/* Phase 8 Decision 2：安静的说明区块，不弹窗、不阻断 */}
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs font-medium text-gray-600">{c.addToHomeScreenTitle}</p>
          <p className="text-xs text-gray-400 mt-1">{c.addToHomeScreenDesc}</p>
        </div>
      </div>

      {/* 导入 */}
      <div className="mx-4 mt-3 border rounded-xl p-4">
        <p className="text-sm font-semibold">{c.importSection}</p>
        <p className="text-xs text-gray-500 mt-1">{c.importHint}</p>

        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileSelected} />

        {importStage.step === 'idle' && (
          <button onClick={handleChooseFile} className="mt-3 rounded-md border px-4 py-2 text-sm">
            {c.chooseFile}
          </button>
        )}

        {importStage.step === 'checking' && (
          <p className="mt-3 text-sm text-gray-500">{c.checking}</p>
        )}

        {importStage.step === 'invalid' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">{c.invalidFile}</p>
            <p className="text-xs text-red-700 mt-1">{importStage.error}</p>
            <button onClick={handleCancelImport} className="mt-2 rounded-md border border-red-300 text-red-800 text-sm px-3 py-1.5">
              {c.cancel}
            </button>
          </div>
        )}

        {(importStage.step === 'ready' || importStage.step === 'importing') && (
          <ImportPreview
            summary={importStage.summary}
            overwriteUserProfile={overwriteUserProfile}
            onToggleOverwrite={setOverwriteUserProfile}
            onCancel={handleCancelImport}
            onConfirm={handleConfirmImport}
            importing={importStage.step === 'importing'}
          />
        )}

        {importStage.step === 'success' && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800">{c.importSuccessTitle} ✓</p>
            <p className="text-xs text-green-700 mt-1">
              {c.importSuccessSummary(
                importStage.result.dailyLogsAdded + importStage.result.weeklyReviewsAdded + importStage.result.workoutSessionsImported,
                importStage.result.dailyLogsUpdated + importStage.result.weeklyReviewsUpdated,
                importStage.result.dailyLogsSkipped + importStage.result.weeklyReviewsSkipped,
              )}
            </p>
            <button onClick={handleCancelImport} className="mt-2 rounded-md border border-green-300 text-green-800 text-sm px-3 py-1.5">
              完成
            </button>
          </div>
        )}

        {importStage.step === 'failed' && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-medium text-red-800">{c.importFailedTitle}</p>
            <p className="text-xs text-red-700 mt-1">{importStage.error}</p>
            <p className="text-xs text-red-700 mt-1">{c.importFailedGenericHint}</p>
            <button onClick={handleCancelImport} className="mt-2 rounded-md border border-red-300 text-red-800 text-sm px-3 py-1.5">
              {c.cancel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ImportPreview({
  summary,
  overwriteUserProfile,
  onToggleOverwrite,
  onCancel,
  onConfirm,
  importing,
}: {
  summary: ImportSummary;
  overwriteUserProfile: boolean;
  onToggleOverwrite: (v: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  importing: boolean;
}) {
  if (summary.schemaCompatibility === 'incompatible_newer') {
    return (
      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-sm font-medium text-red-800">{c.invalidFile}</p>
        <p className="text-xs text-red-700 mt-1">{c.dataCheck}</p>
        <button onClick={onCancel} className="mt-2 rounded-md border border-red-300 text-red-800 text-sm px-3 py-1.5">
          {c.cancel}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-sm font-medium text-blue-900">{c.dataCheck} ✓</p>
      {summary.schemaCompatibility === 'compatible_older' && (
        <p className="text-xs text-blue-800 mt-1">{c.schemaOlderNotice}</p>
      )}

      <p className="text-sm font-medium text-blue-900 mt-3">{c.importPreviewTitle}</p>
      <ul className="mt-1 list-disc list-inside text-sm text-blue-900 space-y-0.5">
        <li>{c.importPreviewDailyLogs(summary.totalDailyLogs)}</li>
        <li>{c.importPreviewWorkoutSessions(summary.totalWorkoutSessions)}</li>
        <li>{c.importPreviewWeeklyReviews(summary.totalWeeklyReviews)}</li>
      </ul>

      <p className="text-xs text-blue-800 mt-2">
        {c.importPreviewNewerWins(
          summary.dailyLogsToAdd + summary.weeklyReviewsToAdd,
          summary.dailyLogsToUpdate + summary.weeklyReviewsToUpdate,
          summary.dailyLogsSkipped + summary.weeklyReviewsSkipped,
        )}
      </p>
      <p className="text-xs text-blue-900 font-medium mt-2">{c.importPreviewNoOverwrite}</p>

      {summary.userProfileConflict && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{c.userConflictTitle}</p>
          <p className="text-xs text-amber-800 mt-1">{c.userConflictDesc}</p>
          <label className="flex items-center gap-2 mt-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={overwriteUserProfile}
              onChange={(e) => onToggleOverwrite(e.target.checked)}
            />
            {c.userConflictCheckbox}
          </label>
          <p className="text-xs text-amber-700 mt-1">{c.userConflictSkipNotice}</p>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={onConfirm}
          disabled={importing}
          className="rounded-md bg-black text-white text-sm px-4 py-2 disabled:opacity-50"
        >
          {importing ? c.importing : c.confirmImport}
        </button>
        <button
          onClick={onCancel}
          disabled={importing}
          className="rounded-md border text-sm px-4 py-2 disabled:opacity-50"
        >
          {c.cancel}
        </button>
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}
