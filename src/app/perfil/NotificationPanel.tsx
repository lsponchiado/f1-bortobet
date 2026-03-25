'use client';

import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { subscribePush, unsubscribePush, getNotificationPreferences, updateNotificationPreferences, sendTestNotification } from '@/lib/push-actions';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-[#e10600]' : 'bg-white/10'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

export function NotificationPanel() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [sessionReminder, setSessionReminder] = useState(false);
  const [betReminder, setBetReminder] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [testActive, setTestActive] = useState(false);
  const [testCountdown, setTestCountdown] = useState(0);
  const testTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      setLoaded(true);
      return;
    }

    // Timeout: if SW takes too long, show toggles anyway
    const timeout = setTimeout(() => setLoaded(true), 3000);

    navigator.serviceWorker.ready.then(async (reg) => {
      clearTimeout(timeout);
      const hasPush = !!reg.pushManager;
      setIsSupported(hasPush);

      if (hasPush) {
        try {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            setIsSubscribed(true);
            const prefs = await getNotificationPreferences();
            setSessionReminder(prefs.sessionReminder);
            setBetReminder(prefs.betReminder);
          }
        } catch (e) {
          console.error('Push check error:', e);
        }
      }
      setLoaded(true);
    }).catch(() => {
      clearTimeout(timeout);
      setLoaded(true);
    });
  }, []);

  const ensureSubscribed = useCallback(async (): Promise<boolean> => {
    if (isSubscribed) return true;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const json = sub.toJSON();
      await subscribePush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh!, auth: json.keys!.auth! },
      });

      setIsSubscribed(true);
      return true;
    } catch (e) {
      console.error('Push subscribe error:', e);
      return false;
    }
  }, [isSubscribed]);

  const handleTestToggle = useCallback((value: boolean) => {
    if (!value) {
      if (testTimerRef.current) clearInterval(testTimerRef.current);
      setTestActive(false);
      setTestCountdown(0);
      return;
    }

    startTransition(async () => {
      const ok = await ensureSubscribed();
      if (!ok) return;

      setTestActive(true);
      setTestCountdown(10);

      let remaining = 10;
      testTimerRef.current = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          if (testTimerRef.current) clearInterval(testTimerRef.current);
          setTestCountdown(0);
          sendTestNotification().finally(() => {
            setTestActive(false);
          });
        } else {
          setTestCountdown(remaining);
        }
      }, 1000);
    });
  }, [ensureSubscribed]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (testTimerRef.current) clearInterval(testTimerRef.current);
    };
  }, []);

  const handleToggleWithSubscribe = useCallback((field: 'sessionReminder' | 'betReminder', value: boolean) => {
    const newSession = field === 'sessionReminder' ? value : sessionReminder;
    const newBet = field === 'betReminder' ? value : betReminder;

    if (field === 'sessionReminder') setSessionReminder(value);
    else setBetReminder(value);

    startTransition(async () => {
      // Turning something on: ensure push is subscribed first
      if (value) {
        const ok = await ensureSubscribed();
        if (!ok) {
          // Revert
          if (field === 'sessionReminder') setSessionReminder(false);
          else setBetReminder(false);
          return;
        }
      }

      await updateNotificationPreferences({ sessionReminder: newSession, betReminder: newBet });

      // Both off: unsubscribe from push entirely
      if (!newSession && !newBet) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await unsubscribePush(sub.endpoint);
            await sub.unsubscribe();
          }
          setIsSubscribed(false);
        } catch (e) {
          console.error('Push unsubscribe error:', e);
        }
      }
    });
  }, [sessionReminder, betReminder, ensureSubscribed]);

  if (!loaded) return null;

  return (
    <div className="bg-[#1f1f27] rounded-3xl border border-white/5 overflow-hidden shadow-xl">
      <div className="h-1 w-full bg-[#e10600]" />
      <div className="p-6 border-b border-white/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-[#e10600]" />
        </div>
        <div>
          <h3 className="font-black uppercase italic tracking-tight text-white">Notificações</h3>
          <p className="text-gray-500 text-xs font-bold mt-0.5">Alertas antes das sessões</p>
        </div>
      </div>

      <div className="px-6 py-2">
        {!isSupported ? (
          <div className="flex items-center gap-3 py-4">
            <BellOff className="w-4 h-4 text-gray-500 shrink-0" />
            <p className="text-gray-500 text-sm font-bold">
              Notificações push não são suportadas neste dispositivo. Adicione o app à tela inicial para ativar.
            </p>
          </div>
        ) : (
          <>
            <label className="flex items-center justify-between gap-4 py-4 border-b border-white/5">
              <span>
                <span className="block text-white text-sm font-bold leading-tight">Lembrete de Sessão</span>
                <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">5 min antes do início</span>
              </span>
              <Toggle value={sessionReminder} onChange={v => handleToggleWithSubscribe('sessionReminder', v)} disabled={isPending} />
            </label>
            <label className="flex items-center justify-between gap-4 py-4 border-b border-white/5">
              <span>
                <span className="block text-white text-sm font-bold leading-tight">Lembrete de Aposta</span>
                <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">30 min antes · sprint e corrida</span>
              </span>
              <Toggle value={betReminder} onChange={v => handleToggleWithSubscribe('betReminder', v)} disabled={isPending} />
            </label>
            <label className="flex items-center justify-between gap-4 py-4">
              <span>
                <span className="block text-white text-sm font-bold leading-tight">Notificação de Teste</span>
                <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                  {testActive ? `Enviando em ${testCountdown}s...` : 'Envia após 10 segundos'}
                </span>
              </span>
              <Toggle value={testActive} onChange={handleTestToggle} disabled={isPending} />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
