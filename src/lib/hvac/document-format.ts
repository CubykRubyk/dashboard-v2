export function formatDocumentSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} o`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} Ko`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} Mo`;
}

export function technicalDocumentFileHref(
  id: string,
  download = false,
) {
  return `/api/pac/technical/documents/${id}${
    download ? "?download=1" : ""
  }`;
}
