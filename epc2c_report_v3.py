"""
EPC2C — MEES Compliance Report v3
- Removed raw SAP references → estimated EPC uplift language
- Added ventilation review section
- Added damp & mould / Awaab readiness section
- Photo evidence integration placeholders
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, Image
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import Flowable
from datetime import date
import os

# ── Palette ────────────────────────────────────────────────
NAVY      = colors.HexColor('#0f1e33')
NAVY_MID  = colors.HexColor('#162843')
TEAL      = colors.HexColor('#4ecba8')
TEAL_DARK = colors.HexColor('#2fa882')
TEAL_PALE = colors.HexColor('#e6f4ec')
WARM      = colors.HexColor('#f5f2ec')
WARM_MID  = colors.HexColor('#ece8e0')
RULE      = colors.HexColor('#e5e1da')
CHARCOAL  = colors.HexColor('#1a2332')
BODY_TEXT = colors.HexColor('#374151')
MUTED     = colors.HexColor('#6b7280')
AMBER     = colors.HexColor('#d97706')
AMBER_PAL = colors.HexColor('#fffbeb')
AMBER_DRK = colors.HexColor('#92400e')
RED       = colors.HexColor('#dc2626')
RED_PAL   = colors.HexColor('#fef2f2')
RED_DRK   = colors.HexColor('#7f1d1d')
GREEN     = colors.HexColor('#059669')
GREEN_PAL = colors.HexColor('#ecfdf5')
PURPLE    = colors.HexColor('#7c3aed')
PURPLE_PAL= colors.HexColor('#f5f3ff')
BLUE      = colors.HexColor('#1d4ed8')
BLUE_PAL  = colors.HexColor('#eff6ff')
WHITE     = colors.white

EPC_COL = {
    'A': colors.HexColor('#166534'), 'B': colors.HexColor('#15803d'),
    'C': colors.HexColor('#16a34a'), 'D': colors.HexColor('#d97706'),
    'E': colors.HexColor('#ea580c'), 'F': colors.HexColor('#dc2626'),
    'G': colors.HexColor('#991b1b'),
}

W = 170 * mm

# ── Style factory ──────────────────────────────────────────
def S(name, **kw):
    d = dict(fontName='Helvetica', fontSize=9, textColor=BODY_TEXT, leading=14, spaceAfter=0)
    d.update(kw)
    return ParagraphStyle(name, **d)

ST = {
    'eyebrow':   S('eb', fontName='Helvetica-Bold', fontSize=8, textColor=TEAL_DARK, leading=12, spaceAfter=3),
    'h2':        S('h2', fontName='Helvetica-Bold', fontSize=13, textColor=CHARCOAL, leading=18),
    'h3':        S('h3', fontName='Helvetica-Bold', fontSize=10, textColor=CHARCOAL, leading=14),
    'body':      S('b'),
    'body_sm':   S('bsm', fontSize=8, textColor=MUTED, leading=12),
    'body_bold': S('bb', fontName='Helvetica-Bold', fontSize=9, textColor=CHARCOAL, leading=14),
    'field_key': S('fk', fontSize=8, textColor=MUTED, leading=12),
    'field_val': S('fv', fontName='Helvetica-Bold', fontSize=9, textColor=CHARCOAL, leading=13),
    'kpi_val':   S('kv', fontName='Helvetica-Bold', fontSize=22, textColor=CHARCOAL, leading=26),
    'kpi_label': S('kl', fontSize=8, textColor=MUTED, leading=11),
    'footer':    S('ft', fontSize=7, textColor=MUTED, leading=10, alignment=TA_CENTER),
    'flag_title':S('ft2', fontName='Helvetica-Bold', fontSize=9, textColor=CHARCOAL, leading=13),
    'flag_body': S('fb', fontSize=8, textColor=BODY_TEXT, leading=12),
    'awaab_urg': S('au', fontName='Helvetica-Bold', fontSize=8, textColor=RED_DRK, leading=12),
}

# ── Helpers ─────────────────────────────────────────────────
def sp(h=3): return Spacer(1, h*mm)
def rule(): return HRFlowable(width=W, thickness=0.4, color=RULE, spaceAfter=3*mm)

def section_divider(number, title, subtitle=None):
    content = f'<font color="#4ecba8"><b>{number:02d}</b></font>  {title}'
    if subtitle:
        content += f'<br/><font size="8" color="#6b7280">{subtitle}</font>'
    t = Table([[Paragraph(content, ParagraphStyle('sd', fontName='Helvetica-Bold',
        fontSize=12, textColor=CHARCOAL, leading=16 if not subtitle else 22))]], colWidths=[W])
    t.setStyle(TableStyle([
        ('LINEBELOW', (0,0), (-1,-1), 1.5, TEAL),
        ('TOPPADDING', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
    ]))
    return t

def info_box(text, style='info'):
    cfg = {
        'info':    (BLUE,   BLUE_PAL),
        'warning': (AMBER,  AMBER_PAL),
        'success': (GREEN,  GREEN_PAL),
        'danger':  (RED,    RED_PAL),
        'purple':  (PURPLE, PURPLE_PAL),
    }
    border, bg = cfg.get(style, (MUTED, WARM))
    t = Table([[Paragraph(text, ST['body'])]], colWidths=[W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg),
        ('LINEBEFORE', (0,0), (0,-1), 3, border),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
        ('BOX', (0,0), (-1,-1), 0.3, border),
    ]))
    return t

def two_col_fields(pairs, lw=40*mm, vw=40*mm):
    row = []
    for label, val in pairs:
        row += [Paragraph(label, ST['field_key']), Paragraph(str(val), ST['field_val'])]
    t = Table([row], colWidths=[lw, vw, lw, vw])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), WARM), ('BACKGROUND', (2,0), (2,-1), WARM),
        ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.3, RULE), ('LINEAFTER', (1,0), (1,-1), 0.4, RULE),
        ('BOX', (0,0), (-1,-1), 0.3, RULE), ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    return t

# ── Custom Flowables ─────────────────────────────────────────

class NavBar(Flowable):
    def __init__(self, ref, report_date, status, width=W):
        super().__init__()
        self.ref, self.report_date, self.status = ref, report_date, status
        self.width = width
        self.height = 22*mm

    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.rect(0, 0, self.width, self.height, fill=1, stroke=0)
        c.setFillColor(TEAL)
        c.rect(0, self.height - 2*mm, self.width, 2*mm, fill=1, stroke=0)
        # Logo
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 20)
        c.drawString(6*mm, 9*mm, 'EPC')
        c.setFillColor(TEAL)
        c.drawString(6*mm + c.stringWidth('EPC','Helvetica-Bold',20), 9*mm, '2')
        c.setFillColor(WHITE); c.setFont('Helvetica-Oblique', 20)
        c.drawString(6*mm + c.stringWidth('EPC2','Helvetica-Bold',20), 9*mm, 'C')
        c.setFillColor(colors.HexColor('#94a3b8')); c.setFont('Helvetica', 8)
        c.drawString(6*mm, 4.5*mm, 'MEES Compliance Report · powered by GoGreen Alliance')
        # Meta right
        c.setFillColor(colors.HexColor('#64748b')); c.setFont('Helvetica', 7.5)
        rx = self.width - 6*mm
        c.drawRightString(rx, 14*mm, f'Ref: {self.ref}')
        c.drawRightString(rx, 10*mm, f'Date: {self.report_date}')
        # Status pill
        scol = {'DRAFT':AMBER,'APPROVED':TEAL,'AWAITING REVIEW':colors.HexColor('#6366f1'),
                'COMPLETED':GREEN}.get(self.status.upper(), MUTED)
        pw = 32*mm; px = self.width - pw - 6*mm
        c.setFillColor(scol); c.roundRect(px, 2*mm, pw, 6*mm, 1.5*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(px + pw/2, 3.5*mm, self.status.upper())


class PropertyHero(Flowable):
    def __init__(self, address, prop_type, era, tenure, width=W):
        super().__init__()
        self.address, self.prop_type = address, prop_type
        self.era, self.tenure = era, tenure
        self.width = width; self.height = 28*mm

    def draw(self):
        c = self.canv
        c.setFillColor(WARM); c.rect(0,0,self.width,self.height,fill=1,stroke=0)
        c.setFillColor(TEAL); c.rect(0,0,2*mm,self.height,fill=1,stroke=0)
        c.setFillColor(MUTED); c.setFont('Helvetica-Bold',7)
        c.drawString(6*mm, self.height-6*mm, 'PROPERTY')
        parts = self.address.split(',')
        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold',14)
        c.drawString(6*mm, self.height-13*mm, parts[0].strip())
        if len(parts)>1:
            c.setFillColor(BODY_TEXT); c.setFont('Helvetica',11)
            c.drawString(6*mm, self.height-19*mm, ', '.join(p.strip() for p in parts[1:]))
        px, py = 6*mm, 3*mm
        c.setFont('Helvetica', 7.5)
        for pill in [self.prop_type, self.era, self.tenure]:
            pw = c.stringWidth(pill,'Helvetica',7.5)+8*mm
            c.setFillColor(WARM_MID); c.roundRect(px,py,pw,5*mm,1.2*mm,fill=1,stroke=0)
            c.setFillColor(BODY_TEXT); c.drawString(px+4*mm,py+1.5*mm,pill)
            px += pw+3*mm


class EpcUplifBar(Flowable):
    """
    Shows current EPC band and projected EPC band after works.
    No raw SAP numbers — just band progression with estimated uplift.
    """
    def __init__(self, current_rating, projected_rating=None, width=W, height=28*mm):
        super().__init__()
        self.current = current_rating
        self.projected = projected_rating
        self.width = width; self.height = height

    def draw(self):
        c = self.canv
        bands = ['G','F','E','D','C','B','A']
        n = len(bands)
        seg_w = (self.width * 0.80) / n
        bar_y = 12*mm; bar_h = 12*mm
        bar_x = 0

        for i, band in enumerate(bands):
            x = bar_x + i * seg_w
            col = EPC_COL[band]
            is_current = band == self.current
            is_projected = band == self.projected

            # Dimmed if below current
            ci = bands.index(self.current)
            if i < ci:
                # past — dim
                c.setFillColor(col); c.setFillAlpha(0.35)
            else:
                c.setFillColor(col); c.setFillAlpha(1.0)

            c.rect(x, bar_y, seg_w, bar_h, fill=1, stroke=0)

            # Band label
            c.setFillAlpha(1.0)
            c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 9)
            c.drawCentredString(x + seg_w/2, bar_y + 3.5*mm, band)

            # Current marker (above bar)
            if is_current:
                c.setFillColor(NAVY)
                p = c.beginPath()
                mx = x + seg_w/2
                p.moveTo(mx-4*mm, bar_y+bar_h+0.5*mm)
                p.lineTo(mx+4*mm, bar_y+bar_h+0.5*mm)
                p.lineTo(mx, bar_y+bar_h+4.5*mm)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
                c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 7)
                c.drawCentredString(mx, bar_y+bar_h+6*mm, 'Current')

            # Projected marker (below bar)
            if is_projected and self.projected != self.current:
                c.setFillColor(TEAL_DARK)
                p2 = c.beginPath()
                mx2 = x + seg_w/2
                p2.moveTo(mx2-4*mm, bar_y-0.5*mm)
                p2.lineTo(mx2+4*mm, bar_y-0.5*mm)
                p2.lineTo(mx2, bar_y-4.5*mm)
                p2.close()
                c.drawPath(p2, fill=1, stroke=0)
                c.setFillColor(TEAL_DARK); c.setFont('Helvetica-Bold', 7)
                c.drawCentredString(mx2, bar_y-7*mm, 'With works')

        c.setFillAlpha(1.0)

        # Right side — big current band box
        panel_x = bar_x + n * seg_w + 5*mm
        panel_w = self.width - panel_x
        c.setFillColor(EPC_COL[self.current])
        c.roundRect(panel_x, bar_y-2*mm, panel_w, bar_h+4*mm, 2*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 30)
        c.drawCentredString(panel_x+panel_w/2, bar_y+2*mm, self.current)
        c.setFont('Helvetica-Bold', 7)
        c.drawCentredString(panel_x+panel_w/2, bar_y+bar_h-2*mm, 'CURRENT')

        # Uplift arrow if projected
        if self.projected and self.projected != self.current:
            ci = bands.index(self.current)
            pi = bands.index(self.projected)
            steps = pi - ci
            uplift = f'+{steps} band{"s" if steps>1 else ""} estimated'
            c.setFillColor(TEAL_DARK); c.setFont('Helvetica-Bold', 8)
            c.drawCentredString(panel_x+panel_w/2, bar_y-7*mm, uplift)


class ComplianceVerdict(Flowable):
    def __init__(self, verdict, title, body, width=W):
        super().__init__()
        self.verdict, self.title, self.body = verdict, title, body
        self.width = width; self.height = 22*mm

    def draw(self):
        c = self.canv
        cfg = {
            'compliant': (GREEN, GREEN_PAL, '✓'),
            'works':     (TEAL_DARK, TEAL_PALE, '→'),
            'exemption': (AMBER, AMBER_PAL, '!'),
            'breach':    (RED, RED_PAL, '✕'),
        }
        bc, bg, icon = cfg.get(self.verdict, (MUTED, WARM, '·'))
        c.setFillColor(bg); c.roundRect(0,0,self.width,self.height,2*mm,fill=1,stroke=0)
        c.setFillColor(bc); c.rect(0,0,3*mm,self.height,fill=1,stroke=0)
        c.setFillColor(bc); c.circle(10*mm, self.height/2, 4*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 10)
        c.drawCentredString(10*mm, self.height/2-3*mm, icon)
        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold', 11)
        c.drawString(18*mm, self.height-8*mm, self.title)
        c.setFillColor(BODY_TEXT); c.setFont('Helvetica', 8.5)
        words = self.body.split()
        line, lines = '', []
        for w in words:
            test = (line+' '+w).strip()
            if c.stringWidth(test,'Helvetica',8.5) < self.width-22*mm:
                line = test
            else:
                lines.append(line); line = w
        if line: lines.append(line)
        for i, ln in enumerate(lines[:2]):
            c.drawString(18*mm, self.height-14*mm-i*5*mm, ln)


class MeasureCard(Flowable):
    def __init__(self, measure, index, width=W):
        super().__init__()
        self.m, self.index = measure, index
        self.width = width; self.height = 24*mm

    def draw(self):
        c = self.canv; m = self.m
        is_sel = m.get('selected', False)
        is_blk = m.get('blocked', False)
        bg     = GREEN_PAL if is_sel else (RED_PAL if is_blk else WARM)
        accent = GREEN if is_sel else (RED if is_blk else WARM_MID)

        c.setFillColor(bg)
        c.roundRect(0,0,self.width,self.height,1.5*mm,fill=1,stroke=0)
        c.setFillColor(accent)
        c.roundRect(0,0,3*mm,self.height,1.5*mm,fill=1,stroke=0)
        c.rect(1.5*mm,0,1.5*mm,self.height,fill=1,stroke=0)

        c.setFillColor(accent); c.setFont('Helvetica-Bold',7)
        c.drawString(5*mm, self.height-5*mm, f'{self.index:02d}')

        status_txt = '✓ SELECTED' if is_sel else ('✕ BLOCKED' if is_blk else 'NOT SELECTED')
        status_col = GREEN if is_sel else (RED if is_blk else MUTED)
        bw = c.stringWidth(status_txt,'Helvetica-Bold',6.5)+6*mm
        c.setFillColor(status_col)
        c.roundRect(self.width-bw-3*mm, self.height-7*mm, bw, 5*mm, 1*mm, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold',6.5)
        c.drawCentredString(self.width-bw/2-3*mm, self.height-5.5*mm, status_txt)

        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold',10)
        name = m['name']
        if c.stringWidth(name,'Helvetica-Bold',10) > self.width-55*mm:
            name = name[:42]+'…'
        c.drawString(5*mm, self.height-11*mm, name)

        c.setFillColor(MUTED); c.setFont('Helvetica',7.5)
        desc = m.get('description','')
        if c.stringWidth(desc,'Helvetica',7.5) > self.width-55*mm:
            desc = desc[:70]+'…'
        c.drawString(5*mm, self.height-16*mm, desc)

        # Pills — cost range + projected uplift (no raw SAP numbers)
        uplift_txt = m.get('projected_uplift','')
        conf = m.get('confidence','Medium')
        conf_col  = GREEN if conf=='High' else (AMBER if conf=='Medium' else RED)
        conf_pale = GREEN_PAL if conf=='High' else (AMBER_PAL if conf=='Medium' else RED_PAL)

        pill_data = [
            (f"£{m['cost_min']:,}–£{m['cost_max']:,}", CHARCOAL, WARM_MID),
            (uplift_txt, TEAL_DARK, TEAL_PALE),
            (m.get('funding','No grant'), PURPLE, PURPLE_PAL),
            (f"{conf} confidence", conf_col, conf_pale),
        ]
        px = 5*mm; py = 2.5*mm; c.setFont('Helvetica-Bold',7)
        for txt, tc, bgc in pill_data:
            if not txt: continue
            pw = c.stringWidth(txt,'Helvetica-Bold',7)+5*mm
            if px+pw > self.width-6*mm: break
            c.setFillColor(bgc); c.roundRect(px,py,pw,4.5*mm,1*mm,fill=1,stroke=0)
            c.setFillColor(tc); c.drawString(px+2.5*mm,py+1.2*mm,txt)
            px += pw+2*mm


class ExemptionCard(Flowable):
    def __init__(self, exemption, width=W):
        super().__init__()
        self.e = exemption; self.width = width
        self.height = (18 + len(exemption.get('requirements',[]))*5)*mm

    def draw(self):
        c = self.canv; e = self.e
        status = e.get('status','locked')
        cfg = {
            'selected': (GREEN, GREEN_PAL, 'REGISTERED'),
            'available':(AMBER, AMBER_PAL, 'AVAILABLE'),
            'locked':   (WARM_MID, WARM, 'NOT APPLICABLE'),
        }
        accent, bg, badge_txt = cfg.get(status, (MUTED, WARM, 'UNKNOWN'))
        c.setFillColor(bg); c.roundRect(0,0,self.width,self.height,1.5*mm,fill=1,stroke=0)
        c.setFillColor(accent)
        c.roundRect(0,0,2.5*mm,self.height,1.5*mm,fill=1,stroke=0)
        c.rect(1.2*mm,0,1.3*mm,self.height,fill=1,stroke=0)

        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold',10)
        c.drawString(6*mm, self.height-7*mm, e['type'])

        bw = c.stringWidth(badge_txt,'Helvetica-Bold',6.5)+6*mm
        c.setFillColor(accent)
        c.roundRect(self.width-bw-3*mm, self.height-8*mm, bw, 5*mm, 1*mm, fill=1, stroke=0)
        tc = WHITE if status!='locked' else MUTED
        c.setFillColor(tc); c.setFont('Helvetica-Bold',6.5)
        c.drawCentredString(self.width-bw/2-3*mm, self.height-6.5*mm, badge_txt)

        c.setFillColor(MUTED); c.setFont('Helvetica',7.5)
        c.drawString(6*mm, self.height-12*mm, f'Valid for: {e.get("duration","10 years")}')

        c.setFillColor(BODY_TEXT); c.setFont('Helvetica',8)
        words = e.get('description','').split()
        line, lo = '', []
        for w in words:
            test=(line+' '+w).strip()
            if c.stringWidth(test,'Helvetica',8)<self.width-12*mm: line=test
            else: lo.append(line); line=w
        if line: lo.append(line)
        for i,ln in enumerate(lo[:2]):
            c.drawString(6*mm, self.height-17*mm-i*4.5*mm, ln)

        reqs = e.get('requirements',[])
        if reqs:
            y = self.height-17*mm-len(lo[:2])*4.5*mm-3*mm
            c.setFillColor(accent); c.setFont('Helvetica-Bold',7)
            c.drawString(6*mm, y, 'EVIDENCE REQUIRED:'); y-=4*mm
            c.setFillColor(BODY_TEXT); c.setFont('Helvetica',7.5)
            for req in reqs:
                c.drawString(8*mm, y, f'· {req}'); y-=4.5*mm


class VentilationFlag(Flowable):
    """Visual ventilation status card — RAG rated"""
    def __init__(self, vent_data, width=W):
        super().__init__()
        self.v = vent_data; self.width = width; self.height = 28*mm

    def draw(self):
        c = self.canv; v = self.v
        rag = v.get('rag','amber')
        cfg = {
            'green': (GREEN, GREEN_PAL, 'ADEQUATE'),
            'amber': (AMBER, AMBER_PAL, 'REVIEW RECOMMENDED'),
            'red':   (RED,   RED_PAL,   'URGENT ATTENTION'),
        }
        accent, bg, badge = cfg.get(rag,(AMBER,AMBER_PAL,'REVIEW'))

        c.setFillColor(bg); c.roundRect(0,0,self.width,self.height,1.5*mm,fill=1,stroke=0)
        c.setFillColor(accent); c.rect(0,0,3*mm,self.height,fill=1,stroke=0)

        # Icon placeholder area
        c.setFillColor(accent); c.circle(10*mm,self.height/2,5*mm,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold',12)
        c.drawCentredString(10*mm,self.height/2-3.5*mm,'V')

        # Badge
        bw = c.stringWidth(badge,'Helvetica-Bold',7)+6*mm
        c.setFillColor(accent)
        c.roundRect(self.width-bw-3*mm,self.height-8*mm,bw,6*mm,1.2*mm,fill=1,stroke=0)
        c.setFillColor(WHITE); c.setFont('Helvetica-Bold',7)
        c.drawCentredString(self.width-bw/2-3*mm,self.height-5.5*mm,badge)

        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold',10)
        c.drawString(19*mm,self.height-7*mm,f'Ventilation: {v.get("type","Unknown")}')

        c.setFillColor(BODY_TEXT); c.setFont('Helvetica',8)
        c.drawString(19*mm,self.height-12*mm,v.get('description',''))

        # Flags
        flags = v.get('flags',[])
        if flags:
            c.setFillColor(accent); c.setFont('Helvetica-Bold',7)
            c.drawString(19*mm,self.height-17*mm,'FLAGS:')
            c.setFillColor(BODY_TEXT); c.setFont('Helvetica',7.5)
            flag_txt = '  ·  '.join(flags)
            c.drawString(19*mm,self.height-22*mm,flag_txt)

        # RdSAP 10 note
        c.setFillColor(MUTED); c.setFont('Helvetica-Oblique',7)
        c.drawString(19*mm,2*mm,'RdSAP 10 ventilation type recorded at assessment')


class DampMouldSection(Flowable):
    """Damp, mould and Awaab readiness assessment card"""
    def __init__(self, damp_data, width=W):
        super().__init__()
        self.d = damp_data; self.width = width
        # Height depends on findings
        n_findings = len(damp_data.get('findings',[]))
        self.height = (32 + n_findings * 6)*mm

    def draw(self):
        c = self.canv; d = self.d
        rag = d.get('rag','amber')
        cfg = {
            'green': (GREEN, GREEN_PAL),
            'amber': (AMBER, AMBER_PAL),
            'red':   (RED,   RED_PAL),
        }
        accent, bg = cfg.get(rag,(AMBER,AMBER_PAL))

        c.setFillColor(bg); c.roundRect(0,0,self.width,self.height,1.5*mm,fill=1,stroke=0)
        c.setFillColor(accent); c.rect(0,0,3*mm,self.height,fill=1,stroke=0)

        # Header
        c.setFillColor(CHARCOAL); c.setFont('Helvetica-Bold',10)
        c.drawString(6*mm,self.height-7*mm,'Damp & mould assessment')

        awaab_txt = d.get('awaab_status','Awaab compliance: unknown')
        aw_col = GREEN if 'compliant' in awaab_txt.lower() else (RED if 'non' in awaab_txt.lower() else AMBER)
        c.setFillColor(aw_col); c.setFont('Helvetica-Bold',8)
        c.drawString(6*mm,self.height-13*mm,awaab_txt)

        # Overall assessment
        c.setFillColor(BODY_TEXT); c.setFont('Helvetica',8.5)
        c.drawString(6*mm,self.height-19*mm,d.get('overall','No damp or mould observed during inspection.'))

        # Individual findings
        findings = d.get('findings',[])
        if findings:
            y = self.height-26*mm
            c.setFillColor(accent); c.setFont('Helvetica-Bold',7)
            c.drawString(6*mm,y,'FINDINGS RECORDED:'); y-=5*mm
            for f in findings:
                sev_col = RED if f.get('severity')=='high' else (AMBER if f.get('severity')=='medium' else MUTED)
                c.setFillColor(sev_col); c.setFont('Helvetica-Bold',7.5)
                c.drawString(6*mm,y,f'● {f["location"]}')
                c.setFillColor(BODY_TEXT); c.setFont('Helvetica',7.5)
                c.drawString(28*mm,y,f.get('description',''))
                c.setFillColor(sev_col)
                sev_lbl = f.get('severity','').upper()
                c.drawRightString(self.width-4*mm,y,sev_lbl)
                y-=5.5*mm

        # Photo evidence note
        n_photos = d.get('photo_count',0)
        c.setFillColor(MUTED); c.setFont('Helvetica-Oblique',7.5)
        if n_photos > 0:
            c.drawString(6*mm,4*mm,f'{n_photos} photo(s) attached as evidence — see appendix')
        else:
            c.drawString(6*mm,4*mm,'No photographic evidence attached')

        # Awaab timeframe reminder
        if rag in ('amber','red'):
            c.setFillColor(RED_DRK); c.setFont('Helvetica-Bold',7)
            c.drawRightString(self.width-4*mm,4*mm,
                'Awaab\'s Law: investigate within 14 days, fix within 7 days of hazard confirmed')


class PhotoPlaceholder(Flowable):
    """Photo evidence placeholder — replaced with actual image in production"""
    def __init__(self, label, image_path=None, width=52*mm, height=39*mm):
        super().__init__()
        self.label = label
        self.image_path = image_path
        self.width = width; self.height = height

    def draw(self):
        c = self.canv
        c.setFillColor(WARM_MID)
        c.roundRect(0,0,self.width,self.height,1.5*mm,fill=1,stroke=0)
        c.setStrokeColor(RULE); c.setLineWidth(0.5)
        c.roundRect(0,0,self.width,self.height,1.5*mm,fill=0,stroke=1)
        c.setFillColor(MUTED); c.setFont('Helvetica',8)
        c.drawCentredString(self.width/2,self.height/2+2*mm,'[ Photo ]')
        c.setFont('Helvetica-Bold',7)
        c.drawCentredString(self.width/2,5*mm,self.label)


# ── MAIN GENERATOR ───────────────────────────────────────────
def generate_report(data, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=20*mm, rightMargin=20*mm,
        topMargin=15*mm, bottomMargin=18*mm,
        title=f"EPC2C — {data['property']['address']}",
        author='EPC2C · GoGreen Alliance'
    )

    d = data
    prop     = d['property']
    parties  = d['parties']
    epc      = d['epc']
    measures = d['measures']
    exemptions= d.get('exemptions',[])
    outcomes = d['outcomes']
    notes    = d.get('notes',{})
    report   = d['report']
    proj_rating = d.get('projected_rating')
    vent     = d.get('ventilation',{})
    damp     = d.get('damp_mould',{})

    story = []

    # ── HEADER ───────────────────────────────────────────────
    story += [NavBar(report['reference'], report['date'], report['status']), sp(4)]

    # ── PROPERTY HERO ────────────────────────────────────────
    story += [PropertyHero(prop['address'],prop['type'],prop['era'],parties['tenure']), sp(5)]

    # ── S1: COMPLIANCE VERDICT ───────────────────────────────
    story.append(section_divider(1,'Compliance verdict'))
    story.append(sp(3))

    cur = epc['rating']
    bands = ['G','F','E','D','C','B','A']
    ci = bands.index(cur)
    pi = bands.index(proj_rating) if proj_rating else ci
    uplift_bands = pi - ci

    if ci >= bands.index('C'):
        verdict,vt,vb = 'compliant', \
            'This property meets EPC C — no further action required', \
            f'EPC {cur} already satisfies the 2030 MEES C standard. We recommend lodging an updated EPC at the next assessment to confirm continued compliance.'
    elif pi >= bands.index('C'):
        verdict,vt,vb = 'works', \
            f'EPC C is achievable — works required by 2030', \
            f'Estimated improvement of {uplift_bands} band{"s" if uplift_bands>1 else ""} with selected measures, projecting EPC {proj_rating}. ' \
            f'Estimated cost: £{sum(m["cost_min"] for m in measures if m.get("selected")):,}–£{sum(m["cost_max"] for m in measures if m.get("selected")):,}. Lodge an updated EPC once works are complete.'
    elif any(e['status'] in ('available','selected') for e in exemptions):
        verdict,vt,vb = 'exemption', \
            'EPC C cannot be reached — a MEES exemption is available', \
            f'EPC {cur}: this property cannot reach EPC C through cost-effective improvements alone. A MEES exemption must be registered on the PRS Exemptions Register before the property is let.'
    else:
        verdict,vt,vb = 'breach', \
            'Non-compliant — immediate action required', \
            f'EPC {cur} is below the minimum standard. This property should not be let without remedial action or a registered exemption.'

    story += [ComplianceVerdict(verdict,vt,vb), sp(4)]

    # KPI strip — no raw SAP, just band, uplift, cost, deadline
    sel = [m for m in measures if m.get('selected')]
    cost_min = sum(m['cost_min'] for m in sel)
    cost_max = sum(m['cost_max'] for m in sel)
    uplift_txt = (f'+{uplift_bands} band{"s" if uplift_bands!=1 else ""}' if uplift_bands>0 else 'Already C+')

    kpi_data = [[
        [Paragraph('EPC Band', ST['kpi_label']),
         Paragraph(f'<font color="{EPC_COL[cur].hexval()}">{cur}</font>',
                   S('kv2',fontName='Helvetica-Bold',fontSize=22,textColor=EPC_COL[cur],leading=26))],
        [Paragraph('Projected band', ST['kpi_label']),
         Paragraph(f'<font color="{EPC_COL.get(proj_rating or cur,MUTED).hexval()}">{proj_rating or cur}</font>',
                   S('kv3',fontName='Helvetica-Bold',fontSize=22,textColor=EPC_COL.get(proj_rating or cur,MUTED),leading=26))],
        [Paragraph('Est. band uplift', ST['kpi_label']),
         Paragraph(f'<font color="{TEAL_DARK.hexval()}">{uplift_txt}</font>',
                   S('kv4',fontName='Helvetica-Bold',fontSize=22,textColor=TEAL_DARK,leading=26))],
        [Paragraph('Est. cost of works', ST['kpi_label']),
         Paragraph(f'£{cost_min:,}–£{cost_max:,}' if cost_min else '—',
                   S('kv5',fontName='Helvetica-Bold',fontSize=16,textColor=CHARCOAL,leading=22))],
    ]]
    kt = Table(kpi_data, colWidths=[W/4]*4)
    kt.setStyle(TableStyle([
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(0,0),(-1,-1),'CENTER'),
        ('BACKGROUND',(0,0),(-1,-1),WARM),
        ('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),
        ('LINEBETWEEN',(0,0),(-1,-1),0.4,RULE),
        ('BOX',(0,0),(-1,-1),0.4,RULE),
    ]))
    story += [kt, sp(5)]

    # ── S2: EPC POSITION ─────────────────────────────────────
    story.append(section_divider(2,'EPC position',
        'Estimated band progression — not an RdSAP calculation'))
    story += [sp(3), EpcUplifBar(cur, proj_rating), sp(4)]

    story.append(info_box(
        '<b>Important:</b> Band uplift estimates are based on the measures selected and '
        'property characteristics. They are planning-level estimates, not a certified RdSAP '
        'calculation. A new EPC assessment by a qualified DEA is required to confirm any '
        'updated rating for MEES compliance purposes.',
        'info'
    ))
    story.append(sp(3))

    # MEES standards
    story.append(Paragraph('MEES standards', ST['eyebrow']))
    story.append(sp(2))
    std_data = [[
        Paragraph('<b>Standard</b>',ST['body_bold']),
        Paragraph('<b>Min. band</b>',ST['body_bold']),
        Paragraph('<b>Deadline</b>',ST['body_bold']),
        Paragraph('<b>This property</b>',ST['body_bold']),
        Paragraph('<b>Status</b>',ST['body_bold']),
    ]]
    for sn,mb,dl in [('EPC E (current)','E','In force now'),('EPC C (upcoming)','C','1 Oct 2030')]:
        mi = bands.index(mb)
        ok = ci >= mi
        proj_ok = pi >= mi if proj_rating else False
        if ok:   stxt = '<font color="#059669"><b>✓ Compliant</b></font>'
        elif proj_ok: stxt = f'<font color="#d97706"><b>→ Achievable with works</b></font>'
        else:    stxt = f'<font color="#dc2626"><b>✕ Action required</b></font>'
        std_data.append([
            Paragraph(sn,ST['body']),
            Paragraph(mb,ST['body']),
            Paragraph(dl,ST['body']),
            Paragraph(f'EPC {cur}',ST['body']),
            Paragraph(stxt,ST['body']),
        ])
    stt = Table(std_data,colWidths=[48*mm,25*mm,35*mm,28*mm,34*mm])
    stt.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),WHITE),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,WARM]),
        ('GRID',(0,0),(-1,-1),0.3,RULE),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
        ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    story += [stt, sp(5)]

    # ── S3: PROPERTY DETAILS ─────────────────────────────────
    story.append(section_divider(3,'Property & construction details'))
    story.append(sp(3))
    con = d['construction']
    story.append(two_col_fields([('EPC reference',epc['reference']),('Expires',epc['expiry_date'])]))
    story.append(two_col_fields([('Wall type',con['walls']),('Roof type',con['roof'])]))
    story.append(two_col_fields([('Floor type',con['floor']),('Glazing',con['glazing'])]))
    story.append(two_col_fields([('Heating',con['heating']),('Controls',con['controls'])]))
    story.append(two_col_fields([('Hot water',con['hot_water']),('Ventilation type',con['ventilation'])]))
    story.append(sp(2))

    conf = epc.get('confidence','Medium')
    conf_msg = {
        'High':   'Cost estimates based on EPC XML data — ±15% accuracy.',
        'Medium': 'Cost estimates based on EPC register data — ±30% accuracy. Upload XML for tighter estimates.',
        'Low':    'Cost estimates based on manual inputs — ±50% accuracy. New EPC assessment recommended.',
    }.get(conf,'')
    story.append(info_box(
        f'<font color="#{"059669" if conf=="High" else "d97706" if conf=="Medium" else "dc2626"}">'
        f'<b>Data confidence: {conf}</b></font> — {conf_msg}',
        'success' if conf=='High' else 'warning' if conf=='Medium' else 'danger'
    ))
    story += [sp(5)]

    # ── S4: IMPROVEMENT MEASURES ─────────────────────────────
    story.append(section_divider(4,'Improvement measures',
        'Estimated costs and projected EPC uplift per measure'))
    story.append(sp(2))
    story.append(Paragraph(
        f'{len(sel)} of {len(measures)} measures selected · '
        f'Estimated cost: £{cost_min:,}–£{cost_max:,} · '
        f'Projected uplift: {uplift_txt}',
        ST['body_sm']
    ))
    story.append(sp(3))
    for i,m in enumerate(measures,1):
        story.append(KeepTogether([MeasureCard(m,i), sp(2)]))
    story.append(sp(3))

    # ── S5: VENTILATION REVIEW ───────────────────────────────
    story.append(section_divider(5,'Ventilation review',
        'RdSAP 10 ventilation type · assessed at inspection'))
    story.append(sp(3))

    if vent:
        story.append(VentilationFlag(vent))
        story.append(sp(3))

        # Recommendations
        vent_recs = vent.get('recommendations',[])
        if vent_recs:
            story.append(Paragraph('Ventilation recommendations', ST['eyebrow']))
            story.append(sp(1))
            for rec in vent_recs:
                story.append(info_box(f'<b>{rec["type"]}:</b> {rec["detail"]}',
                    'danger' if rec.get('priority')=='high' else 'warning'))
                story.append(sp(1))
        story.append(sp(2))

        story.append(info_box(
            '<b>Why ventilation matters for MEES:</b> Improvements such as draught-proofing, '
            'insulation and new windows increase airtightness. Without adequate ventilation, '
            'this can increase condensation, damp and mould risk — and reduce indoor air quality. '
            'RdSAP 10 captures ventilation type as a rated input. Ventilation upgrades may '
            'contribute to the estimated EPC band improvement.',
            'info'
        ))
    else:
        story.append(info_box('Ventilation data not recorded at this assessment. '
            'RdSAP 10 includes ventilation type as a rated field. Recommend recording '
            'ventilation type at next inspection.','warning'))
    story.append(sp(5))

    # ── S6: DAMP, MOULD & AWAAB READINESS ───────────────────
    story.append(section_divider(6,"Damp, mould & Awaab's Law readiness",
        "Awaab's Law — Renters' Rights Act 2025 · photo evidence overleaf"))
    story.append(sp(3))

    if damp:
        story.append(DampMouldSection(damp))
        story.append(sp(3))

        # Awaab Law summary box
        story.append(info_box(
            '<b>Awaab\'s Law — what landlords must do:</b><br/>'
            '· Investigate any reported damp or mould hazard within <b>14 days</b><br/>'
            '· Fix a confirmed hazard within <b>7 days</b><br/>'
            '· Fix an emergency hazard within <b>24 hours</b><br/>'
            '· Provide written repair record to tenant<br/>'
            'Non-compliance exposes landlords to compensation claims and enforcement action. '
            'Currently applies to social housing; extending to PRS under the Renters\' Rights Act.',
            'purple'
        ))
        story.append(sp(3))

        # Photo evidence grid (placeholder — replaced with actual images in production)
        photos = damp.get('photos',[])
        if photos:
            story.append(Paragraph('Photographic evidence', ST['eyebrow']))
            story.append(sp(2))
            # 3 photos per row
            photo_rows = [photos[i:i+3] for i in range(0,len(photos),3)]
            for row in photo_rows:
                cells = [PhotoPlaceholder(p['label'],p.get('path')) for p in row]
                while len(cells) < 3:
                    cells.append(Spacer(52*mm,39*mm))
                pt = Table([cells], colWidths=[52*mm,52*mm,52*mm], rowHeights=[42*mm])
                pt.setStyle(TableStyle([
                    ('ALIGN',(0,0),(-1,-1),'CENTER'),
                    ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                    ('LEFTPADDING',(0,0),(-1,-1),3),
                    ('RIGHTPADDING',(0,0),(-1,-1),3),
                ]))
                story += [pt, sp(2)]
    else:
        story.append(info_box(
            'Damp and mould assessment not recorded. Recommend completing this section '
            'to support Awaab\'s Law compliance and evidence any future tenant complaints.',
            'warning'
        ))
    story.append(sp(5))

    # ── S7: MEES EXEMPTIONS ──────────────────────────────────
    story.append(section_divider(7,'MEES exemption assessment'))
    story.append(sp(3))
    avail = [e for e in exemptions if e['status'] in ('available','selected')]
    if avail:
        story.append(info_box(
            '<b>Exemptions must be registered</b> on the PRS Exemptions Register before '
            'the property is let. Registration is not automatic. Under 2026 regulations, '
            'exemptions are valid for <b>10 years</b>. GoGreen Alliance offers a fully '
            'managed registration service from £149.',
            'warning'
        ))
        story.append(sp(3))
    for e in exemptions:
        story.append(KeepTogether([ExemptionCard(e), sp(2)]))
    story.append(sp(3))

    # ── S8: ACTION PLAN ──────────────────────────────────────
    story.append(section_divider(8,'Action plan'))
    story.append(sp(3))
    ah = [[Paragraph(h,ST['body_bold']) for h in ['Action','Required','Est. cost','By','Deadline']]]
    ar = ah[:]
    for o in outcomes:
        tick = ('<font color="#059669"><b>✓</b></font>' if o['required']
                else '<font color="#9ca3af">—</font>')
        ar.append([
            Paragraph(o['action'],ST['body']),
            Paragraph(tick,ST['body']),
            Paragraph(f"£{o['cost']:,}" if o.get('cost') else '—',ST['body']),
            Paragraph(o.get('responsible','—'),ST['body_sm']),
            Paragraph(o.get('deadline','2030'),ST['body_sm']),
        ])
    at = Table(ar,colWidths=[62*mm,18*mm,24*mm,42*mm,24*mm])
    at.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),NAVY),('TEXTCOLOR',(0,0),(-1,0),WHITE),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[WHITE,WARM]),
        ('GRID',(0,0),(-1,-1),0.3,RULE),
        ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
        ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'),
    ]))
    story += [at, sp(5)]

    # ── S9: PARTIES & SIGN-OFF ───────────────────────────────
    story.append(section_divider(9,'Parties & sign-off'))
    story.append(sp(3))
    story.append(two_col_fields([('Landlord/owner',parties['landlord']),('Tenant',parties['tenant'])]))
    story.append(two_col_fields([('Instructed by',parties['instructed_by']),('Local authority',parties['local_authority'])]))
    story.append(two_col_fields([('Surveyor',parties['surveyor']),('DEA accreditation',parties['dea_number'])]))
    story.append(two_col_fields([('Funding group',parties['funding_group']),('Survey date',prop['survey_date'])]))
    story.append(sp(3))

    if notes.get('surveyor_notes'):
        story.append(Paragraph('Surveyor observations',ST['eyebrow']))
        story.append(sp(1))
        story.append(info_box(notes['surveyor_notes'],'info'))
        story.append(sp(2))
    if notes.get('access_notes'):
        story.append(Paragraph('Access & constraints',ST['eyebrow']))
        story.append(sp(1))
        story.append(info_box(notes['access_notes'],'info'))
        story.append(sp(3))

    # Sign-off boxes
    sof = Table([[
        [Paragraph('<b>Surveyor sign-off</b>',ST['h3']), sp(2),
         Paragraph(f'Name: {parties["surveyor"]}',ST['body']),
         Paragraph(f'DEA No: {parties["dea_number"]}',ST['body']),
         Paragraph(f'Date: {report["date"]}',ST['body']),
         sp(5), Paragraph('Signature: ________________________________',ST['body'])],
        [Paragraph('<b>Compliance review</b>',ST['h3']), sp(2),
         Paragraph(f'Reviewer: {notes.get("reviewer_name","_____________________")}',ST['body']),
         Paragraph(f'Date: {notes.get("reviewer_date","_____________________")}',ST['body']),
         Paragraph('Decision:  ☐ Approved    ☐ Rejected    ☐ Amend',ST['body']),
         sp(5), Paragraph('Signature: ________________________________',ST['body'])],
    ]], colWidths=[83*mm,83*mm])
    sof.setStyle(TableStyle([
        ('BOX',(0,0),(0,-1),0.5,RULE),('BOX',(1,0),(1,-1),0.5,RULE),
        ('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),
        ('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),
        ('VALIGN',(0,0),(-1,-1),'TOP'),('LINEAFTER',(0,0),(0,-1),0.4,RULE),
    ]))
    story += [sof, sp(5)]

    # ── FOOTER ───────────────────────────────────────────────
    story.append(HRFlowable(width=W,thickness=0.4,color=RULE))
    story.append(sp(2))
    story.append(Paragraph(
        f'<b>EPC2C</b> · Ref: {report["reference"]} · {report["date"]} · '
        'epc2c.co.uk · 0330 998 0641 · Powered by GoGreen Alliance Ltd<br/>'
        'Band uplift estimates are indicative planning tools, not certified RdSAP calculations. '
        'A qualified DEA must lodge a new EPC to confirm any rating change. '
        'MEES exemptions require PRS register registration. © GoGreen Alliance Ltd.',
        ST['footer']
    ))

    doc.build(story)
    print(f'✓ Report generated: {output_path}')


# ── SAMPLE DATA ──────────────────────────────────────────────
if __name__ == '__main__':
    sample = {
        'report': {
            'reference': 'EPC2C-2025-001',
            'date': date.today().strftime('%d/%m/%Y'),
            'version': '3.0',
            'status': 'Draft',
        },
        'property': {
            'address': '15 Prestwood Avenue, Wolverhampton, WV11 3TY',
            'type': 'Semi-detached house',
            'era': '1965–1980',
            'bedrooms': '3',
            'survey_date': date.today().strftime('%d/%m/%Y'),
        },
        'parties': {
            'surveyor': 'Mr Marcus Dingwall',
            'dea_number': 'DEA/2018/00123',
            'instructed_by': 'Letmedirect.com',
            'landlord': 'Sukhdev Jandu',
            'tenant': 'Ms Elizabeth Sutton',
            'tenure': 'PRS — Assured tenancy',
            'funding_group': 'ECO: Help2Heat (Benefits)',
            'local_authority': 'City of Wolverhampton Council',
        },
        'epc': {
            'rating': 'E',
            'reference': '0000-1234-5678-9012-3456',
            'lodged_date': '01/08/2012',
            'expiry_date': '01/08/2022',
            'confidence': 'Medium',
        },
        'projected_rating': 'D',   # <-- band, not SAP
        'construction': {
            'walls': 'Solid brick — uninsulated',
            'roof': 'Pitched — loft converted, no access',
            'floor': 'Solid concrete',
            'glazing': 'Single glazed — original timber frames',
            'heating': 'Non-condensing combi boiler (Vaillant)',
            'controls': '2 TRVs of 8 radiators, no programmer',
            'hot_water': 'Combi boiler',
            'ventilation': 'Natural ventilation — background ventilators absent',
        },
        'mees': {'current_standard': 'E'},
        'measures': [
            {
                'name': 'Boiler upgrade — A-rated condensing combi',
                'description': 'Replace non-condensing Vaillant. Add full TRV set and programmer.',
                'selected': True, 'blocked': False,
                'projected_uplift': 'Partial band uplift',
                'cost_min': 600, 'cost_max': 1200,
                'funding': 'ECO4 / Help2Heat', 'confidence': 'High',
            },
            {
                'name': 'Heating controls — full TRV set & programmer',
                'description': 'Upgrade all 8 radiators to TRVs plus programmable thermostat.',
                'selected': True, 'blocked': False,
                'projected_uplift': 'Minor uplift',
                'cost_min': 250, 'cost_max': 450,
                'funding': 'ECO4', 'confidence': 'High',
            },
            {
                'name': 'Secondary glazing — single glazed windows',
                'description': 'Internal secondary glazing to all single-glazed windows.',
                'selected': False, 'blocked': False,
                'projected_uplift': 'Partial band uplift',
                'cost_min': 800, 'cost_max': 1800,
                'funding': 'GBIS', 'confidence': 'Medium',
            },
            {
                'name': 'Solid wall insulation (internal)',
                'description': 'External render prevents external application.',
                'selected': False, 'blocked': True,
                'projected_uplift': 'Significant uplift',
                'cost_min': 4500, 'cost_max': 8000,
                'funding': 'ECO4 / GBIS', 'confidence': 'Low',
            },
            {
                'name': 'Loft insulation',
                'description': 'Loft converted — no fixed staircase. Not applicable.',
                'selected': False, 'blocked': True,
                'projected_uplift': '—',
                'cost_min': 0, 'cost_max': 0,
                'funding': 'None', 'confidence': 'High',
            },
        ],
        'ventilation': {
            'type': 'Natural ventilation (background ventilators absent)',
            'rag': 'amber',
            'description': 'No trickle vents or background ventilators observed. Relies on infiltration and opening windows.',
            'flags': [
                'No trickle vents on replacement windows',
                'Kitchen and bathroom extract fans present',
                'No whole-house mechanical ventilation',
            ],
            'recommendations': [
                {
                    'type': 'Trickle vent installation',
                    'detail': 'Background ventilators (trickle vents) should be fitted to all habitable rooms to meet Part F requirements, especially if windows are to be upgraded.',
                    'priority': 'high',
                },
                {
                    'type': 'Humidity-controlled extract fans',
                    'detail': 'Consider upgrading kitchen and bathroom extract fans to humidity-controlled units to reduce condensation risk.',
                    'priority': 'medium',
                },
            ],
        },
        'damp_mould': {
            'rag': 'amber',
            'overall': 'Minor condensation mould observed in bedroom 3 and bathroom. No structural damp identified.',
            'awaab_status': 'Awaab compliance: action recommended — mould present',
            'findings': [
                {'location': 'Bedroom 3 (north wall)', 'description': 'Black mould to window reveal, approx 0.3m²', 'severity': 'medium'},
                {'location': 'Bathroom ceiling', 'description': 'Condensation mould to ceiling corners', 'severity': 'low'},
            ],
            'photo_count': 4,
            'photos': [
                {'label': 'Bedroom 3 — north wall mould', 'path': None},
                {'label': 'Bathroom — ceiling mould', 'path': None},
                {'label': 'Window reveal — detail', 'path': None},
                {'label': 'Overview — bedroom 3', 'path': None},
            ],
        },
        'exemptions': [
            {
                'type': 'Wall insulation exemption',
                'status': 'available',
                'description': 'Solid wall construction with external render makes insulation impractical. Internal insulation would reduce room dimensions unacceptably.',
                'duration': '10 years',
                'requirements': [
                    'Written confirmation from qualified installer',
                    'Photographs of external render condition',
                    'DEA report confirming solid wall construction',
                ],
            },
            {
                'type': 'All improvements made exemption',
                'status': 'locked',
                'description': 'Available once all feasible measures installed and property still cannot reach EPC C.',
                'duration': '10 years',
                'requirements': [
                    'Installation certificates for all completed measures',
                    'Updated EPC post-installation',
                    'Written confirmation no further measures are feasible',
                ],
            },
        ],
        'outcomes': [
            {'action':'Install A-rated boiler + full heating controls','required':True,'cost':850,'responsible':'GoGreen Alliance','deadline':'Before next tenancy'},
            {'action':'Address bedroom 3 mould — improve ventilation','required':True,'cost':200,'responsible':'Landlord','deadline':'Within 14 days (Awaab\'s Law)'},
            {'action':'Install trickle vents to habitable rooms','required':True,'cost':350,'responsible':'GoGreen Alliance','deadline':'With boiler works'},
            {'action':'Lodge updated EPC post-installation','required':True,'cost':75,'responsible':'DEA','deadline':'Within 30 days of works'},
            {'action':'Register wall insulation exemption on PRS register','required':True,'cost':149,'responsible':'GoGreen Alliance (managed)','deadline':'Before next tenancy'},
            {'action':'Install secondary glazing (optional — improves rating)','required':False,'cost':1300,'responsible':'Landlord','deadline':'Optional — by 2028'},
        ],
        'notes': {
            'surveyor_notes': 'Property in reasonable condition. Loft converted — no fixed staircase. External render prevents external wall insulation. Boiler is old and inefficient — replacement is the most cost-effective measure. Ventilation is inadequate for the level of airtightness following window replacement.',
            'access_notes': 'Full access granted by tenant. Loft hatch present but no ladder. Rear elevation accessible.',
            'reviewer_name': '',
            'reviewer_date': '',
        },
    }

    generate_report(sample, '/mnt/user-data/outputs/EPC2C_Report_v3.pdf')
