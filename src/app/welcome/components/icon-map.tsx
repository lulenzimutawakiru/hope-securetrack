/**
 * Welcome Experience — lucide icon resolver.
 * Maps metadata icon names to components so every module/integration/step
 * can be rendered from configuration without hardcoding.
 */
"use client";

import {
  Landmark, Wallet, Users, UserPlus, Clock, Contact, ShoppingCart, ShoppingBag,
  Boxes, Factory, BadgeCheck, Wrench, Truck, Box, FolderKanban, Headphones,
  FileText, Workflow, BrainCircuit, BarChart3, IdCard, ScrollText, Store, Hotel,
  Utensils, School, HeartPulse, Sprout, HardHat, Mail, MessageSquare,
  MessageCircle, Hash, Cloud, CreditCard, Smartphone, KeyRound, Server,
  Fingerprint, Radio, Braces, Webhook, Building2, Network, ShieldCheck, Blocks,
  Settings2, Upload, Plug, GraduationCap, Gauge, Rocket, PartyPopper, Sparkles,
  ArrowRight, ArrowLeft, Send, CheckCircle2, Loader2, SkipForward, Save,
  CircleHelp, X, CalendarClock, PlayCircle, UploadCloud, Zap, Database, Globe2,
  AlertTriangle, RefreshCw, Menu, Bot, LayoutGrid, QrCode, MapPin, Users2,
  UserCheck, TrendingUp, Package, Scale, Coins, Cpu, HardDrive, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Landmark, Wallet, Users, UserPlus, Clock, Contact, ShoppingCart, ShoppingBag,
  Boxes, Factory, BadgeCheck, Wrench, Truck, Box, FolderKanban, Headphones,
  FileText, Workflow, BrainCircuit, BarChart3, IdCard, ScrollText, Store, Hotel,
  Utensils, School, HeartPulse, Sprout, HardHat, Mail, MessageSquare,
  MessageCircle, Hash, Cloud, CreditCard, Smartphone, KeyRound, Server,
  Fingerprint, Radio, Braces, Webhook, Building2, Network, ShieldCheck, Blocks,
  Settings2, Upload, Plug, GraduationCap, Gauge, Rocket, PartyPopper, Sparkles,
  ArrowRight, ArrowLeft, Send, CheckCircle2, Loader2, SkipForward, Save,
  CircleHelp, X, CalendarClock, PlayCircle, UploadCloud, Zap, Database, Globe2,
  AlertTriangle, RefreshCw, Menu, Bot, LayoutGrid, QrCode, MapPin, Users2,
  UserCheck, TrendingUp, Package, Scale, Coins, Cpu, HardDrive,
};

export function iconByName(name?: string | null): LucideIcon {
  if (!name) return LayoutGrid;
  return ICONS[name] ?? LayoutGrid;
}