import { LOGO_PATHS } from '../utils/juz40LogoPaths';

// JUZ40 сөзбелгісі (брендбук Logo.svg). Түсі — currentColor, сондықтан
// ақ фонда қою, қою фонда ақ болып көрінеді.
export default function Juz40Logo({ height = 18, title = 'JUZ40', ...rest }) {
  return (
    <svg height={height} viewBox="0 0 230 72" fill="currentColor" role="img" aria-label={title} {...rest}>
      {LOGO_PATHS.map((d) => <path key={d.slice(0, 12)} d={d} />)}
    </svg>
  );
}
