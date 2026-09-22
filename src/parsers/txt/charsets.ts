/**
 * 编码标签相关的常量与判断，**不依赖 chardet**。
 *
 * 单独一个文件是为了让 UI 能引用编码列表而不把 chardet 拉进主包：
 * 书架上的「解析设置」只是一个下拉框，不该为此下载一个编码检测库。
 * 检测逻辑在 encoding.ts。
 */

/** 手动覆盖用的候选列表。中文小说里出现频率高的排前面 */
export const MANUAL_CHARSETS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'gb18030', label: 'GB18030（含 GBK / GB2312）' },
  { value: 'big5', label: 'Big5（繁体）' },
  { value: 'utf-16le', label: 'UTF-16 LE' },
  { value: 'utf-16be', label: 'UTF-16 BE' },
  { value: 'shift_jis', label: 'Shift_JIS（日文）' },
  { value: 'euc-kr', label: 'EUC-KR（韩文）' },
  { value: 'windows-1252', label: 'windows-1252（西文）' },
]

/** TextDecoder 认不认这个标签。chardet 的返回值不一定能用，必须实测 */
export function isSupportedLabel(label: string): boolean {
  try {
    new TextDecoder(label)
    return true
  } catch {
    return false
  }
}

export function charsetLabel(charset: string | undefined): string {
  if (!charset) return '未知'
  return MANUAL_CHARSETS.find((item) => item.value === charset)?.label ?? charset
}
