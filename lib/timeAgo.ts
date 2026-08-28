export function timeAgo(pubDate: string): string {
  const parsed = Date.parse(pubDate);
  if (Number.isNaN(parsed)) return "";

  const diffMin = Math.round((Date.now() - parsed) / 60000);
  if (diffMin < 60) {
    return diffMin <= 1 ? "1 minuut geleden" : `${diffMin} minuten geleden`;
  }

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "1 uur geleden" : `${diffHours} uur geleden`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? "1 dag geleden" : `${diffDays} dagen geleden`;
}
