import { deptColor, initials } from '../../utils/deptColor';

// Бөлімнің түсті бас әріптері (аватар орнына)
export default function DeptAvatar({ id, name, size = 32 }) {
  const c = deptColor(id);
  return (
    <span className="ov-av" style={{ width: size, height: size, background: `${c}1f`, color: c, fontSize: size * 0.34 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
