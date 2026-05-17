import { useNavigate } from 'react-router-dom';

export function PostScreen() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        padding: 24,
        fontFamily: 'Syne, sans-serif',
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-page)',
      }}
    >
      Post
      <button onClick={() => navigate(-1)} style={{ display: 'block', marginTop: 12 }}>
        close
      </button>
    </div>
  );
}
