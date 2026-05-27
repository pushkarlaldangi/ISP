'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { DisclaimerModal } from './disclaimer-modal';

interface Props {
  disclaimerAccepted: boolean;
  children: React.ReactNode;
}

export function PortfolioShell({ disclaimerAccepted, children }: Props) {
  const [showDisclaimer, setShowDisclaimer] = useState(!disclaimerAccepted);
  const router = useRouter();

  function handleAccepted() {
    setShowDisclaimer(false);
    router.refresh();
  }

  return (
    <>
      {showDisclaimer && <DisclaimerModal onAccepted={handleAccepted} />}
      {children}
    </>
  );
}
