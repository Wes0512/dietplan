import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// jsdom（组件测试用的环境）目前没有实现 Blob/File.prototype.text()，
// 但真实浏览器（包括 iPhone Safari）完全支持这个标准 API，
// BackupPage 用它读取用户选择的备份文件是正确、现代的写法。
// 这里只是给测试环境本身打个 polyfill，不代表生产代码有问题。
if (typeof Blob !== 'undefined' && typeof FileReader !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}
