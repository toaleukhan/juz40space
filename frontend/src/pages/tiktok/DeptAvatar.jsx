import { useContext, useState } from 'react';
import { deptColor, initials } from '../../utils/deptColor';
import { AvatarContext, avatarUrl } from './avatarContext';

// Бөлімнің TikTok авасы. Ава әлі тартылмаса немесе жүктелмесе — бөлімнің
// түсіндегі бас әріптер.
export default function DeptAvatar({ id, name, size = 32 }) {
  const versions = useContext(AvatarContext);
  const version = versions[id];
  const [failed, setFailed] = useState(null);
  const c = deptColor(id);
  const box = { width: size, height: size };

  if (version && failed !== version) {
    return (
      <span className="ov-av ov-av--img" style={{ ...box, '--c': c }} aria-hidden="true">
        <img src={avatarUrl(id, version)} alt="" width={size} height={size} loading="lazy" decoding="async"
          onError={() => setFailed(version)} />
      </span>
    );
  }
  return (
    <span className="ov-av" style={{ ...box, background: `${c}1f`, color: c, fontSize: size * 0.34 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
