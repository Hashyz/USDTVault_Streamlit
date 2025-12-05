import { useState } from 'react';
import SendReceiveModal from '../SendReceiveModal';
import { Button } from '@/components/ui/button';

export default function SendReceiveModalExample() {
  const [open, setOpen] = useState(false);
  
  return (
    <div>
      <Button onClick={() => setOpen(true)}>Open Modal</Button>
      <SendReceiveModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
