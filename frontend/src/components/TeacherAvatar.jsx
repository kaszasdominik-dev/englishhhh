import React, { useState } from 'react';

export function TeacherAvatar({ teacher, className = '', imgClassName = '' }) {
  const [failed, setFailed] = useState(false);
  const name = teacher?.name || 'LIVO';
  const initial = teacher?.initial || name.slice(0, 1).toUpperCase();

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden bg-brand-soft text-brand font-heading font-extrabold ${className}`}
      aria-label={name}
    >
      {!failed && teacher?.img ? (
        <img
          alt=""
          aria-hidden="true"
          src={teacher.img}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover ${imgClassName}`}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
