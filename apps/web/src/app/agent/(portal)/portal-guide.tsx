"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BedDouble, BookOpen, Building2, ChartNoAxesColumnIncreasing, Check, CheckCheck, ChevronRight, CircleHelp, Compass, CreditCard, LayoutDashboard, MapPin, Plane, Search, ShieldCheck, Stamp, Ticket, UsersRound, Wallet, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { agentGuideSteps, parseGuideProgress, type GuideProgress, type GuideStep } from "./portal-guide-content";
import styles from "./portal-guide.module.css";

const ICONS = { overview: LayoutDashboard, account: ShieldCheck, wallet: Wallet, customers: UsersRound, booking: Plane, tracking: CheckCheck };

export function AgentPortalGuide({ userId, agencyId, role, autoShow = false }: { userId: string; agencyId: string; role: string; autoShow?: boolean }) {
  const steps = agentGuideSteps(role);
  const storageKey = `sts:agent-guide:v1:${agencyId}:${userId}`;
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    if (!autoShow) return;
    // Record the welcome before opening: refreshes and later visits never auto-replay it.
    const timer = window.setTimeout(() => {
      try {
        const seenKey = `${storageKey}:seen`;
        const progress = parseGuideProgress(localStorage.getItem(storageKey), steps.length);
        if (localStorage.getItem(seenKey) || progress) return;
        localStorage.setItem(seenKey, "1");
      } catch {
        // Without persistent storage, keep automatic prompts off. Manual replay still works.
        return;
      }
      setOpen(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [storageKey, steps.length, autoShow]);

  function save(status: GuideProgress["status"], next = index) {
    try { localStorage.setItem(storageKey, JSON.stringify({ status, step: next })); } catch { /* Storage is optional. */ }
  }
  function changeStep(next: number) {
    try { localStorage.setItem(`${storageKey}:seen`, "1"); } catch { /* Storage is optional. */ }
    setIndex(next);
    save("in_progress", next);
  }
  function close(status: "dismissed" | "complete") {
    save(status);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(last ? "complete" : "dismissed"); else setOpen(true); }}>
      <section className={styles.launcher} aria-label="Agent portal guide">
        <span className={styles.launcherIcon}><Compass aria-hidden="true" /></span>
        <div><strong>Your portal, step by step</strong><span>Workspace · Wallet · Customers · Bookings</span></div>
        <DialogTrigger className={styles.launchButton} onClick={() => { changeStep(0); setOpen(true); }}><BookOpen size={16} aria-hidden="true" />Portal guide<ArrowRight size={16} aria-hidden="true" /></DialogTrigger>
      </section>
      <DialogContent className={styles.dialog} showCloseButton={false}>
        <aside className={styles.itinerary}>
          <div className={styles.brand}><Compass size={23} aria-hidden="true" /><span>STS SOMALIA</span></div>
          <div className={styles.kicker}>AGENT PORTAL GUIDE</div>
          <h2>Your agency.<br />One workspace.</h2>
          <nav aria-label="Tour steps">
            <ol>{steps.map((item, i) => <li key={item.id}>
              <button type="button" onClick={() => changeStep(i)} aria-current={i === index ? "step" : undefined} className={i === index ? styles.activeStep : undefined}>
                <span className={styles.stepNumber}>{i < index ? <Check size={14} aria-hidden="true" /> : String(i + 1).padStart(2, "0")}</span><span>{item.label}</span>{i === index && <ChevronRight size={14} aria-hidden="true" />}
              </button>
            </li>)}</ol>
          </nav>
          <span className={styles.sidebarNote}><CircleHelp size={15} aria-hidden="true" />Replay from your dashboard anytime</span>
        </aside>
        <div className={styles.main}>
          <header className={styles.topbar}><span>GETTING STARTED <b>{String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</b></span><button type="button" className={styles.close} aria-label="Close portal guide" onClick={() => close(last ? "complete" : "dismissed")}><X size={19} aria-hidden="true" /></button></header>
          <div className={styles.progress} role="progressbar" aria-label="Tour progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1}><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
          <div className={styles.body}>
            <GuideIllustration step={step} />
            <div className={styles.stepContent} aria-live="polite" aria-atomic="true">
              <span className={styles.location}><MapPin size={13} aria-hidden="true" />{step.location}</span>
              <DialogTitle className={styles.title}>{step.title}</DialogTitle>
              <DialogDescription className={styles.description}>{step.description}</DialogDescription>
              <ol className={styles.tasks}>{step.tasks.map((task, i) => <li key={task}><span>{i + 1}</span>{task}</li>)}</ol>
              {!last && <Link href={step.action.href} className={styles.actionLink} onClick={() => close("dismissed")}>{step.action.label}<ArrowRight size={15} aria-hidden="true" /></Link>}
            </div>
          </div>
          <footer className={styles.footer}>
            <button type="button" className={styles.skip} onClick={() => close("dismissed")}>Skip tour</button>
            <div><button type="button" className={styles.back} onClick={() => changeStep(index - 1)} disabled={index === 0}><ArrowLeft size={16} aria-hidden="true" />Back</button>
              {last ? <Link className={styles.next} href={step.action.href} onClick={() => close("complete")}>{step.action.label}<ArrowRight size={16} aria-hidden="true" /></Link> : <button type="button" className={styles.next} onClick={() => changeStep(index + 1)}>Next step<ArrowRight size={16} aria-hidden="true" /></button>}
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small diagrams mirror the portal, rather than relying on downloaded illustrations. */
function GuideIllustration({ step }: { step: GuideStep }) {
  const Icon = ICONS[step.id];
  const personalAccount = step.id === "account" && step.action.href === "/agent/security";
  return <div className={styles.visual} aria-hidden="true">
    <div className={styles.orbit} />
    <div className={styles.mockWindow}>
      <div className={styles.mockBar}><i /><i /><i /><span>Agent Portal</span><ShieldCheck size={13} /></div>
      <div className={styles.mockLayout}>
        <div className={styles.mockNav}>{[LayoutDashboard, UsersRound, Wallet, Building2].map((NavIcon, i) => <span key={i}><NavIcon size={14} /></span>)}</div>
        <div className={styles.mockContent}>
          <div className={styles.mockHeading}><Icon size={17} /><strong>{step.label}</strong></div>
          {step.id === "overview" && <><div className={styles.statCards}>{[Ticket, ChartNoAxesColumnIncreasing, Wallet].map((Stat, i) => <div key={i}><Stat size={16} /><b /><small /></div>)}</div><div className={styles.chart}>{[28, 47, 35, 65, 52, 83, 72].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></>}
          {step.id === "account" && <><div className={styles.profile}><span><Building2 size={24} /></span><div><b>{personalAccount ? "Your account" : "Agency profile"}</b><small>{personalAccount ? "Login & security" : "Logo & contact details"}</small></div></div><div className={styles.mockRow}><CreditCard size={16} />{personalAccount ? "Username" : "Bank details"}<Check size={15} /></div><div className={styles.mockRow}><ShieldCheck size={16} />Security<Check size={15} /></div></>}
          {step.id === "wallet" && <><div className={styles.wallet}><Wallet size={24} /><span>Agency wallet</span><strong>Available funds</strong></div><div className={styles.flow}><span><CreditCard size={18} />Top up</span><ArrowRight size={16} /><span><Wallet size={18} />Wallet</span><ArrowRight size={16} /><span><Ticket size={18} />Payment</span></div></>}
          {step.id === "customers" && <><div className={styles.search}><Search size={14} />Find a customer</div>{["Traveller details", "Travel documents", "Booking history"].map((label, i) => <div className={styles.mockRow} key={label}><span className={styles.avatar}>{[UsersRound, ShieldCheck, Ticket].map((RowIcon, j) => j === i ? <RowIcon key={j} size={15} /> : null)}</span>{label}<ChevronRight size={14} /></div>)}</>}
          {step.id === "booking" && <><div className={styles.services}>{[[Plane, "Flights"], [BedDouble, "Hotels"], [Stamp, "Visas"]].map(([Service, label]) => { const ServiceIcon = Service as typeof Plane; return <div key={String(label)}><ServiceIcon size={22} /><span>{String(label)}</span></div>; })}</div><div className={styles.bookingFlow}><span>Service</span><ArrowRight size={12} /><span>Customer</span><ArrowRight size={12} /><span>Review</span></div><div className={styles.mockRow}><Ticket size={16} />New reservation<ChevronRight size={14} /></div></>}
          {step.id === "tracking" && <><div className={styles.success}><CheckCheck size={30} /><strong>Your workspace is ready</strong></div><div className={styles.mockRow}><Ticket size={16} />Bookings<ChevronRight size={14} /></div><div className={styles.mockRow}><ChartNoAxesColumnIncreasing size={16} />Commissions & earnings<ChevronRight size={14} /></div></>}
        </div>
      </div>
    </div>
    <span className={styles.floatingBadge}><Icon size={18} /><Check size={12} /></span>
  </div>;
}
