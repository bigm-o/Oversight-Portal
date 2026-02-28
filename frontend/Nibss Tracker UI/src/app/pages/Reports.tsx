import { Card, CardContent } from '@/app/components/ui/card';
import { FileText, Clock, Rocket, ShieldCheck, Download, BarChart3 } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';

export function Reports() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 space-y-8 animate-in fade-in zoom-in duration-700">
      {/* Visual Identity */}
      <div className="relative group">
        <div className="absolute -inset-4 bg-gradient-to-r from-green-600/20 to-blue-600/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-70" />
        <div className="relative w-32 h-32 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <FileText className="w-16 h-16 text-green-600 animate-pulse" />
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>

      {/* Main Text */}
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight italic uppercase">
          Reports & Summaries
        </h1>
        <p className="text-xl text-muted-foreground font-medium leading-relaxed">
          The heavy-duty reporting engine for NIBSS IT Governance is currently being engineered.
          Soon, you'll be able to generate executive-ready documents with a single click.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Badge variant="outline" className="px-4 py-1.5 bg-green-500/5 text-green-600 border-green-500/20 text-sm font-bold uppercase tracking-widest">
            Coming in v2.0
          </Badge>
          <Badge variant="outline" className="px-4 py-1.5 bg-blue-500/5 text-blue-600 border-blue-500/20 text-sm font-bold uppercase tracking-widest flex items-center gap-2">
            <Rocket className="w-4 h-4" /> Priority Feature
          </Badge>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-8">
        {[
          { icon: Download, title: 'Executive PDF/Excel', desc: 'One-click exports for board meetings and audit reviews.' },
          { icon: Clock, title: 'Trend Intelligence', desc: 'Automated week-over-week analysis of delivery velocity.' },
          { icon: ShieldCheck, title: 'Automated Dispatch', desc: 'Scheduled inbox delivery for designated stakeholders.' }
        ].map((feat, i) => (
          <Card key={i} className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 group hover:border-green-500/50 transition-colors">
            <CardContent className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mx-auto mb-2 text-green-600 group-hover:scale-110 transition-transform">
                <feat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground">{feat.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Signature */}
      <div className="pt-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white rounded-full text-white dark:text-slate-900 text-sm font-bold shadow-xl">
          Under development by Governance automation admin
        </div>
      </div>
    </div>
  );
}
