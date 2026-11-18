type ClipboardToast = (kind: 'success' | 'warn', title: string) => void

export async function copyTextWithToast(
  text: string,
  successMessage: string,
  toast: ClipboardToast,
  writeText: (value: string) => Promise<void> = (value) => navigator.clipboard.writeText(value)
) {
  try {
    await writeText(text)
    toast('success', successMessage)
  } catch {
    toast('warn', '无法访问剪贴板')
  }
}
