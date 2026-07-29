import { useEffect, useState } from 'react';

export interface StatusMessage {
  message: string;
  isError: boolean;
  id: number;
}

export default function StatusToast({ status }: { status: StatusMessage | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!status) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(t);
  }, [status?.id]);

  if (!status) return null;

  return (
    <div className={`status${visible ? ' visible' : ''}`}>
      <span className={status.isError ? 'error-text' : undefined}>{status.message}</span>
    </div>
  );
}
