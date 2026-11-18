// The range input serializes seconds to 15 significant digits. Compare in that
// same precision so an integer export frame and its preview select the same cut.
export function cutContainsTime(cut: {start:number; end:number}, time:number) {
  const seconds = Number(time.toPrecision(15));
  return seconds >= Number(cut.start.toPrecision(15)) && seconds < Number(cut.end.toPrecision(15));
}
