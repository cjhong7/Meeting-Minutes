#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
학교 협의록 작성기 사용설명서 PDF 생성
디자인: 한글팡팡 게임 사용자설명서 스타일 참고
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame,
    Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable,
    NextPageTemplate
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
import sys

# ─────────────────────────────────────────────────
# 폰트 등록
# ─────────────────────────────────────────────────
try:
    pdfmetrics.registerFont(TTFont('KR',  'C:/Windows/Fonts/malgun.ttf'))
    pdfmetrics.registerFont(TTFont('KRB', 'C:/Windows/Fonts/malgunbd.ttf'))
    print("[OK] font registered")
except Exception as e:
    print(f"[ERROR] font: {e}"); sys.exit(1)

# ─────────────────────────────────────────────────
# 색상
# ─────────────────────────────────────────────────
NAVY    = HexColor('#0D1F45')    # 표지 배경 · 챕터 박스
NAVY2   = HexColor('#17375E')    # 테이블 헤더
BLUE    = HexColor('#2E5BAD')    # 섹션 제목
BLUE_L  = HexColor('#D6E4F7')    # 연파랑 콜아웃
BLUE_R  = HexColor('#EEF4FC')    # 테이블 짝수행
GREEN   = HexColor('#E2EFDA')    # 초록 콜아웃
YELLW   = HexColor('#FFF2CC')    # 노랑 콜아웃
ORANG   = HexColor('#FCE4D6')    # 주황 · 경고
GRAY    = HexColor('#F5F5F5')    # 연회색 (팁)
LINE    = HexColor('#BFBFBF')    # 구분선
DKGRAY  = HexColor('#595959')    # 보조 텍스트
TEXT    = HexColor('#1A1A1A')    # 본문
RED     = HexColor('#C00000')    # 경고 텍스트
PW, PH  = A4
ML, MR  = 1.8*cm, 1.8*cm
MT, MB  = 2.2*cm, 2.0*cm
TW      = PW - ML - MR          # 내용 너비

# ─────────────────────────────────────────────────
# 스타일
# ─────────────────────────────────────────────────
def S(name, fn='KR', sz=10, ld=15, col=TEXT, sb=0, sa=4, al=TA_LEFT, li=0, fi=0):
    return ParagraphStyle(name, fontName=fn, fontSize=sz, leading=ld, textColor=col,
                          spaceBefore=sb, spaceAfter=sa, alignment=al,
                          leftIndent=li, firstLineIndent=fi)

SS = {
    'body':    S('body', sz=9.5, ld=15, sa=4, al=TA_JUSTIFY),
    'body_l':  S('body_l', sz=9.5, ld=15, sa=3),
    'bullet':  S('bullet', sz=9.5, ld=15, sa=2, li=14, fi=-10),
    'num':     S('num', sz=9.5, ld=15, sa=2, li=18, fi=-14),
    'note':    S('note', sz=8.5, ld=13, col=DKGRAY, sa=2),
    'sec':     S('sec', fn='KRB', sz=12, ld=18, col=BLUE, sb=14, sa=5),
    'subsec':  S('subsec', fn='KRB', sz=10.5, ld=16, col=NAVY, sb=8, sa=4),
    'chap':    S('chap', fn='KRB', sz=14, ld=20, col=white, li=4),
    'cell_h':  S('cell_h', fn='KRB', sz=9, ld=13, col=white, al=TA_CENTER),
    'cell_hb': S('cell_hb', fn='KRB', sz=8.5, ld=12, col=white, al=TA_CENTER),
    'cell':    S('cell', sz=9, ld=13, al=TA_CENTER),
    'cell_l':  S('cell_l', sz=9, ld=13),
    'cell_lb': S('cell_lb', fn='KRB', sz=9, ld=13),
    'warn_t':  S('warn_t', fn='KRB', sz=9.5, ld=14, col=RED),
    'code':    S('code', fn='Courier', sz=8.5, ld=13, col=HexColor('#1F3864')),
    # 표지용
    'cv_top':  S('cv_top', sz=9, ld=14, col=HexColor('#9DC3E6'), al=TA_CENTER),
    'cv_main': S('cv_main', fn='KRB', sz=34, ld=44, col=white, al=TA_CENTER),
    'cv_sub':  S('cv_sub', sz=18, ld=28, col=HexColor('#B8CCE4'), al=TA_CENTER),
    'cv_th':   S('cv_th', fn='KRB', sz=9, ld=13, col=white, al=TA_CENTER),
    'cv_td':   S('cv_td', sz=9, ld=13, col=HexColor('#D6E4F7'), al=TA_CENTER),
    'cv_foot': S('cv_foot', sz=9, ld=14, col=HexColor('#9DC3E6'), al=TA_CENTER),
    # 한장 요약
    'qs_title':S('qs_title', fn='KRB', sz=15, ld=20, col=white),
    'qs_intro':S('qs_intro', sz=9.5, ld=15, col=HexColor('#1F3864')),
    'qs_step': S('qs_step', fn='KRB', sz=10, ld=15, col=NAVY, sb=2),
    'qs_sec':  S('qs_sec', fn='KRB', sz=11, ld=16, col=NAVY, sb=8, sa=4),
}

# ─────────────────────────────────────────────────
# 페이지 이벤트
# ─────────────────────────────────────────────────
class Doc(BaseDocTemplate):
    def __init__(self, fn):
        super().__init__(fn, pagesize=A4,
                         leftMargin=ML, rightMargin=MR,
                         topMargin=MT + 0.5*cm, bottomMargin=MB + 0.5*cm)
        self._content_page = 0
        cover_fr = Frame(0, 0, PW, PH, leftPadding=ML, rightPadding=MR,
                         topPadding=3.2*cm, bottomPadding=MB)
        body_fr  = Frame(ML, MB + 0.4*cm, TW, PH - MT - MB - 1.0*cm,
                         leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates([
            PageTemplate(id='cover', frames=[cover_fr], onPage=self._cv),
            PageTemplate(id='body',  frames=[body_fr],  onPage=self._hf),
        ])

    def _cv(self, c, doc):
        c.saveState()
        c.setFillColor(NAVY)
        c.rect(0, 0, PW, PH, fill=1, stroke=0)
        # 상단 소제목
        c.setFont('KR', 8.5)
        c.setFillColor(HexColor('#9DC3E6'))
        c.drawCentredString(PW/2, PH - 1.25*cm,
            '학교 교사 개인 개발 · 무료 배포  |  웹브라우저 / 설치 불필요 / 백엔드 없음')
        # 상단선
        c.setStrokeColor(HexColor('#2E5BAD'))
        c.setLineWidth(0.8)
        c.line(ML, PH - 1.55*cm, PW - MR, PH - 1.55*cm)
        # 하단선
        c.line(ML, MB + 0.5*cm, PW - MR, MB + 0.5*cm)
        # 하단 크레딧
        c.setFont('KR', 8.5)
        c.setFillColor(HexColor('#9DC3E6'))
        c.drawCentredString(PW/2, MB + 0.18*cm, '2026년 6월    제작: Claude (Anthropic) × cjhong7')
        c.restoreState()

    def _hf(self, c, doc):
        c.saveState()
        pg = doc.page - 1   # 표지 제외
        # 헤더
        c.setFont('KR', 8.5)
        c.setFillColor(DKGRAY)
        c.drawString(ML, PH - MT + 0.12*cm, '학교 협의록 작성기 사용설명서')
        c.drawRightString(PW - MR, PH - MT + 0.12*cm, 'v2026.06')
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.line(ML, PH - MT - 0.1*cm, PW - MR, PH - MT - 0.1*cm)
        # 푸터
        c.line(ML, MB + 0.15*cm, PW - MR, MB + 0.15*cm)
        c.setFillColor(DKGRAY)
        c.drawCentredString(PW/2, MB - 0.18*cm, f'-- {pg} --')
        c.restoreState()

# ─────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────
def sp(h=0.25):  return Spacer(1, h*cm)
def hr():        return HRFlowable(width='100%', thickness=0.4, color=LINE, spaceAfter=4, spaceBefore=4)

def chapter(title):
    data = [[Paragraph(title, SS['chap'])]]
    t = Table(data, colWidths=[TW])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
    ]))
    return [PageBreak(), t, sp(0.3)]

def section(t):   return [Paragraph(t, SS['sec']), sp(0.05)]
def subsec(t):    return [Paragraph(t, SS['subsec']), sp(0.05)]
def body(t):      return Paragraph(t, SS['body'])
def body_l(t):    return Paragraph(t, SS['body_l'])
def bul(t):       return Paragraph(f'  -  {t}', SS['bullet'])
def num(n, t):    return Paragraph(f'{n}.  {t}', SS['num'])
def note(t):      return Paragraph(f'※ {t}', SS['note'])

def box(text, bg=BLUE_L, bc=BLUE, style_key='body_l'):
    d = [[Paragraph(text, SS[style_key])]]
    t = Table(d, colWidths=[TW])
    t.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), bg),
        ('BOX',           (0,0), (-1,-1), 0.5, bc),
        ('TOPPADDING',    (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING',   (0,0), (-1,-1), 10),
        ('RIGHTPADDING',  (0,0), (-1,-1), 10),
    ]))
    return t

def warn(text):   return box(text, bg=ORANG, bc=RED, style_key='warn_t')
def tip(text):    return box(text, bg=GREEN,  bc=HexColor('#375623'))
def info(text):   return box(text, bg=BLUE_L, bc=BLUE)
def caution(text):return box(text, bg=YELLW,  bc=HexColor('#9C6500'))

def tbl(data, cw, hdr=True, alt=True, first_bold=False):
    ts = [
        ('GRID',         (0,0), (-1,-1), 0.4, LINE),
        ('TOPPADDING',   (0,0), (-1,-1), 5),
        ('BOTTOMPADDING',(0,0), (-1,-1), 5),
        ('LEFTPADDING',  (0,0), (-1,-1), 7),
        ('RIGHTPADDING', (0,0), (-1,-1), 7),
        ('VALIGN',       (0,0), (-1,-1), 'MIDDLE'),
    ]
    if hdr:
        ts += [
            ('BACKGROUND',   (0,0), (-1,0), NAVY2),
            ('TEXTCOLOR',    (0,0), (-1,0), white),
            ('FONTNAME',     (0,0), (-1,0), 'KRB'),
            ('ALIGN',        (0,0), (-1,0), 'CENTER'),
        ]
        if alt:
            ts.append(('ROWBACKGROUNDS', (0,1), (-1,-1), [white, BLUE_R]))
    else:
        if alt:
            ts.append(('ROWBACKGROUNDS', (0,0), (-1,-1), [white, BLUE_R]))
    if first_bold:
        ts += [
            ('FONTNAME',     (0,1), (0,-1), 'KRB'),
            ('BACKGROUND',   (0,1), (0,-1), BLUE_L),
            ('ALIGN',        (0,1), (0,-1), 'CENTER'),
        ]
    t = Table(data, colWidths=cw)
    t.setStyle(TableStyle(ts))
    return t

def H(*cells):
    return [Paragraph(str(c), SS['cell_h']) for c in cells]
def D(*cells):
    return [Paragraph(str(c), SS['cell']) for c in cells]
def DL(*cells):
    r = []
    for i,c in enumerate(cells):
        r.append(Paragraph(str(c), SS['cell'] if i == 0 else SS['cell_l']))
    return r
def DLb(*cells):
    r = []
    for i,c in enumerate(cells):
        r.append(Paragraph(str(c), SS['cell_lb'] if i == 0 else SS['cell_l']))
    return r

# ─────────────────────────────────────────────────
# 표지
# ─────────────────────────────────────────────────
def make_cover():
    cw_info = [TW*0.28, TW*0.72]
    cw_toc  = [TW*0.18, TW*0.82]

    def cv_row(a, b):
        return [Paragraph(a, SS['cv_th']), Paragraph(b, SS['cv_td'])]

    info_table = Table([
        [Paragraph('구  분', SS['cv_th']), Paragraph('내  용', SS['cv_th'])],
        cv_row('프로그램명', '학교 협의록 작성기'),
        cv_row('접속 URL',   'https://cjhong7.github.io/Meeting-Minutes/'),
        cv_row('개    발',   '교사 개인 개발 · 무료 배포 (설치 불필요)'),
        cv_row('AI 엔진',    'OpenAI GPT-4o  /  Google Gemini  /  Anthropic Claude  /  키 없음(무료)'),
        cv_row('지원 브라우저', 'Chrome, Edge (최신 버전 권장)'),
        cv_row('버    전',   'v1.0  (2026년 6월)'),
    ], colWidths=cw_info)
    info_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  HexColor('#1D4E89')),
        ('BACKGROUND',    (0,1), (-1,-1), HexColor('#162A4A')),
        ('GRID',          (0,0), (-1,-1), 0.3, HexColor('#2E5BAD')),
        ('TOPPADDING',    (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))

    toc_table = Table([
        [Paragraph('구  분', SS['cv_th']), Paragraph('내  용', SS['cv_th'])],
        [Paragraph('요  약', SS['cv_th']), Paragraph('한장 요약 (Quick Start) — 이 페이지만 읽어도 즉시 사용 가능', SS['cv_td'])],
        [Paragraph('1장',  SS['cv_th']), Paragraph('시작하기 (접속 · 첫 실행 · 화면 구성)', SS['cv_td'])],
        [Paragraph('2장',  SS['cv_th']), Paragraph('AI 설정 (⚙ 버튼) — 엔진 선택 · API 키 · 비용', SS['cv_td'])],
        [Paragraph('3장',  SS['cv_th']), Paragraph('회의 정보 입력 — 회의명 · 안건 · 참석자', SS['cv_td'])],
        [Paragraph('4장',  SS['cv_th']), Paragraph('작성 방식 선택 — 타자 · 녹음 · 계획서 · 펜', SS['cv_td'])],
        [Paragraph('5장',  SS['cv_th']), Paragraph('협의록 생성 — AI 자동 작성 절차 · 후처리', SS['cv_td'])],
        [Paragraph('6장',  SS['cv_th']), Paragraph('내보내기 — 인쇄 · 엑셀 · 워드(.doc)', SS['cv_td'])],
        [Paragraph('7장',  SS['cv_th']), Paragraph('보관함 활용 — 자동 저장 · 불러오기 · 클라우드 백업', SS['cv_td'])],
        [Paragraph('8장',  SS['cv_th']), Paragraph('자주 묻는 질문 (FAQ)', SS['cv_td'])],
        [Paragraph('9장',  SS['cv_th']), Paragraph('개인정보 및 보안 안내', SS['cv_td'])],
    ], colWidths=cw_toc)
    toc_table.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,0),  HexColor('#1D4E89')),
        ('BACKGROUND',    (0,1), (-1,-1), HexColor('#162A4A')),
        ('GRID',          (0,0), (-1,-1), 0.3, HexColor('#2E5BAD')),
        ('TOPPADDING',    (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING',   (0,0), (-1,-1), 8),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
        ('VALIGN',        (0,0), (-1,-1), 'MIDDLE'),
    ]))

    return [
        sp(0.3),
        Paragraph('학교 협의록 작성기', SS['cv_main']),
        sp(0.3),
        Paragraph('사용설명서', SS['cv_sub']),
        sp(0.8),
        info_table,
        sp(0.5),
        toc_table,
    ]

# ─────────────────────────────────────────────────
# 한장 요약 (Quick Start)
# ─────────────────────────────────────────────────
def make_quickstart():
    items = []

    # 제목 박스
    title_data = [[Paragraph('⚡  한장 요약 (Quick Start) — 바쁘면 이 페이지만!', SS['qs_title'])]]
    title_tbl = Table(title_data, colWidths=[TW])
    title_tbl.setStyle(TableStyle([
        ('BACKGROUND',    (0,0), (-1,-1), NAVY),
        ('TOPPADDING',    (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 9),
        ('LEFTPADDING',   (0,0), (-1,-1), 12),
        ('RIGHTPADDING',  (0,0), (-1,-1), 8),
    ]))
    items.append(title_tbl)
    items.append(sp(0.15))
    items.append(info('이 페이지만 읽어도 프로그램을 바로 사용할 수 있습니다. 세부 내용은 각 장을 참조하세요.'))
    items.append(sp(0.25))

    # 5단계 빠른 시작
    items.append(Paragraph('① 접속하기', SS['qs_sec']))
    items.append(body('크롬(Chrome) 또는 엣지(Edge) 브라우저 주소창에 입력:'))
    items.append(sp(0.1))
    items.append(info('<b>https://cjhong7.github.io/Meeting-Minutes/</b>'))
    items.append(sp(0.05))
    items.append(note('처음 접속 시 이용 안내 팝업이 표시됩니다. 내용 확인 후 [확인하고 시작하기]를 클릭합니다.'))
    items.append(sp(0.2))

    items.append(Paragraph('② AI 설정 (선택 — API 키가 없으면 건너뜁니다)', SS['qs_sec']))
    items.append(tbl([
        H('방법', '설명'),
        DL('키 없음 (무료)', 'AI 설정 불필요. [협의록 생성] 시 양식만 정리. 비용 0원.'),
        DL('API 키 있음',   '상단 [⚙] 버튼 → 엔진 선택 → API 키 입력 → [설정 저장]'),
    ], [TW*0.25, TW*0.75]))
    items.append(sp(0.2))

    items.append(Paragraph('③ 회의 정보 입력', SS['qs_sec']))
    items.append(tbl([
        H('항목', '입력 방법'),
        DL('회의명', '협의회 명칭 입력 (예: 교육과정 협의회)'),
        DL('날짜·시간', '날짜 선택기 클릭 · 시간 입력 (선택사항)'),
        DL('장소', '회의 장소 입력 (예: 교무실)'),
        DL('안건', '안건 입력 + [＋ 안건 추가] 버튼으로 여러 안건 등록'),
        DL('참석자', '[−] / [＋] 버튼으로 인원 수 조절 → 이름 입력 (최대 16명)'),
    ], [TW*0.22, TW*0.78]))
    items.append(sp(0.2))

    items.append(Paragraph('④ 내용 입력 방식 선택 (1가지만 선택)', SS['qs_sec']))
    items.append(tbl([
        H('방식', '특징', '추천 상황'),
        DL('⌨ 타자 (기본)', '직접 타이핑. [협의안건]/[전달사항] 태그 지원. 🎤 받아쓰기 버튼 제공.', '가장 간단, 처음 사용자 추천'),
        DL('🎤 녹음',       '실시간 마이크 녹음 또는 오디오 파일 업로드 후 STT 변환', '회의를 직접 녹음할 때'),
        DL('📄 계획서',     'HWPX · PDF · DOCX 파일 업로드 → 텍스트 자동 추출', '기존 계획서 기반 협의록 작성'),
        DL('✏ 펜',          '터치 · 마우스로 손글씨 → OCR 텍스트 추출', '태블릿 환경'),
    ], [TW*0.18, TW*0.45, TW*0.37]))
    items.append(sp(0.2))

    items.append(Paragraph('⑤ 협의록 생성 → 저장', SS['qs_sec']))
    items.append(tbl([
        H('단계', '방법'),
        DL('협의록 생성', '[협의록 생성 →] 버튼 클릭 → AI 전송 확인 팝업 → [생성하기]'),
        DL('결과 확인',   '오른쪽 미리보기 패널에서 협의록 내용 확인'),
        DL('저장',        '[📊 엑셀 다운로드] 또는 [🖨 인쇄] 또는 워드 다운로드'),
    ], [TW*0.22, TW*0.78]))
    items.append(sp(0.3))

    # AI 엔진 비교
    items.append(Paragraph('AI 엔진 비교', SS['qs_sec']))
    items.append(tbl([
        H('엔진', '특징', 'STT(음성→텍스트)', '비용'),
        DL('OpenAI GPT-4o',  '최고 품질 협의록', 'Whisper API 지원',        '회당 약 8~30원\n(녹음 60분 ~490원)'),
        DL('Google Gemini',  '높은 품질·무료 할당',  '오디오 파일 직접 분석', '무료 할당 초과 시 유료'),
        DL('Claude (Anthropic)', '높은 품질·자연스러운 문체', '브라우저 음성인식 자동 대체', '회당 약 3~100원'),
        DL('키 없음',        '무료·오프라인 가능', '지원 안 됨', '완전 무료'),
    ], [TW*0.22, TW*0.27, TW*0.28, TW*0.23]))
    items.append(sp(0.3))

    # 자주 묻는 질문
    items.append(Paragraph('자주 묻는 질문 — 빠른 해결', SS['qs_sec']))
    items.append(tbl([
        H('증상', '빠른 해결'),
        DL('녹음이 텍스트로 안 바뀌어요',
           '파일 첨부 탭 → Whisper(OpenAI 키) 또는 Gemini 엔진으로 변환하세요. 실시간 녹음은 브라우저 무료 인식(정확도 한계 있음).'),
        DL('API 키를 어디서 받나요?',
           'OpenAI: platform.openai.com/api-keys  /  Gemini: ai.google.dev  /  Claude: anthropic.com/api'),
        DL('협의록이 저장이 안 돼요',
           '생성 후 자동으로 보관함에 저장됩니다. [📂 협의록 불러오기]로 확인하세요. 브라우저 캐시 삭제 시 사라질 수 있으니 엑셀로 별도 보관 권장.'),
        DL('한글(.hwp) 파일을 올리면 오류가 나요',
           '구형 .hwp는 지원 불가. 한글에서 [파일→다른 이름으로 저장→.hwpx]로 변환 후 업로드하세요.'),
        DL('새 브라우저에서 이전 협의록이 없어요',
           '보관함은 브라우저별로 저장됩니다. 이전 브라우저에서 접속하거나, 클라우드 폴더를 보관함으로 지정하세요.'),
    ], [TW*0.3, TW*0.7]))

    return items

# ─────────────────────────────────────────────────
# 1장: 시작하기
# ─────────────────────────────────────────────────
def ch1():
    items = chapter('1장  시작하기')

    items += section('1-1  접속 방법')
    items.append(body('본 프로그램은 별도의 소프트웨어 설치 없이 웹 브라우저에서 바로 사용합니다. '
                       '인터넷이 연결된 환경이라면 언제 어디서나 접속할 수 있습니다.'))
    items.append(sp(0.15))
    items.append(info('<b>접속 주소:  https://cjhong7.github.io/Meeting-Minutes/</b>\n'
                      '크롬(Chrome) 또는 엣지(Edge) 브라우저에서 위 주소를 입력하고 Enter를 누릅니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('브라우저', '지원 수준'),
        DL('크롬 (Chrome)',         '모든 기능 완전 지원 — 권장'),
        DL('엣지 (Edge)',           '대부분 지원. 일부 기능 제한 가능'),
        DL('파이어폭스 (Firefox)',  '일부 기능 제한 (녹음 STT 등). 비권장'),
        DL('모바일 크롬/엣지',      '접속 가능하나 폴더 지정 기능 제한'),
    ], [TW*0.35, TW*0.65]))
    items.append(sp(0.1))
    items.append(note('인터넷 연결이 없어도 [키 없음] 모드에서 양식 정리 기능과 보관함 조회는 오프라인으로 가능합니다.'))
    items.append(sp(0.1))

    items += section('1-2  처음 실행 — 이용 안내 동의')
    items.append(body('처음 접속하면 이용 안내 및 동의 팝업이 표시됩니다. '
                       '아래 내용을 확인한 뒤 [확인하고 시작하기]를 클릭합니다. '
                       '이후에는 팝업이 자동으로 건너뜁니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('구분', '내용'),
        DL('데이터 저장',    '회의 녹음·문서·필기 등 원본 데이터는 사용자 기기에만 저장됩니다.'),
        DL('AI 전송',        '협의록 생성 시에만 입력 내용이 OpenAI·Gemini·Claude 서버로 전송됩니다.'),
        DL('면책',           '데이터 손실, API 키 유출, AI 생성 오류에 대해 개발자는 책임지지 않습니다.'),
        DL('개인정보 주의',  '학생 개인정보를 회의 내용에 포함하지 않도록 주의하세요.'),
        DL('녹음 동의',      '녹음 전 반드시 참석자 전원의 동의를 받으세요.'),
    ], [TW*0.25, TW*0.75]))
    items.append(sp(0.1))
    items.append(note('[이용 안내 다시 보기] 버튼을 클릭하면 언제든지 이 안내를 다시 확인할 수 있습니다.'))
    items.append(sp(0.1))

    items += section('1-3  화면 구성')
    items.append(body('프로그램 화면은 크게 다섯 영역으로 구성됩니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('영역', '위치', '주요 기능'),
        DL('헤더',            '화면 최상단', '앱 제목 / ⚙ AI 설정 버튼 / 4단계 사용 가이드 (① API Key 설정 → ② 안건·내용 입력 → ③ 협의록 생성 → ④ 엑셀 다운로드·편집)'),
        DL('도구바',          '헤더 아래',   '[＋ 새로작성] / [📁 보관함 폴더 지정] / [❓ 클라우드 연동 안내] / [📂 협의록 불러오기] / [📊 엑셀 다운로드]'),
        DL('1쪽 입력 패널',   '화면 왼쪽',   '회의 정보 · 안건 · 참석자 · 작성 방식 선택 · 내용 입력 영역'),
        DL('2쪽 미리보기',    '화면 오른쪽', '실시간 협의록 미리보기 (인쇄 시 이 영역이 출력됨)'),
        DL('탭 버튼 (태블릿)','화면 상단',   '"1쪽 입력" / "2쪽 미리보기" 전환 버튼 (소형 화면에서 표시)'),
    ], [TW*0.22, TW*0.18, TW*0.60]))
    items.append(sp(0.1))
    items.append(note('태블릿·소형 화면: 상단 탭 버튼으로 입력 화면과 미리보기 화면을 전환합니다.'))
    items.append(note('[＋ 새로작성] 버튼을 누르면 현재 작업을 초기화하고 새 협의록을 시작합니다.'))

    return items

# ─────────────────────────────────────────────────
# 2장: AI 설정
# ─────────────────────────────────────────────────
def ch2():
    items = chapter('2장  AI 설정 (⚙ 버튼)')

    items += section('2-1  AI 엔진 선택')
    items.append(body('상단 헤더의 [⚙] 아이콘 버튼을 클릭하면 AI 엔진 설정 창이 열립니다. '
                       '사용할 엔진을 하나 선택합니다. AI 키가 없으면 "키 없음"을 선택하면 됩니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('엔진', '특징', 'STT 음성인식', '추천 모델', '비용'),
        DL('GPT-4o\n(OpenAI)',       '최고 품질 협의록 작성',       'Whisper API 지원\n(오디오 파일 변환)',        'gpt-4.1-mini\n(저가·빠름)',          '회당 8~30원\n녹음60분 ~490원'),
        DL('Gemini\n(Google)',       '높은 품질\n오디오 직접 분석',  '오디오 파일을\nbase64 변환 후 직접 전송',    'gemini-2.5-pro\n(고품질·무료)',       '무료 할당\n초과 시 유료'),
        DL('Claude\n(Anthropic)',    '높은 품질\n자연스러운 문체',   '브라우저 음성인식으로\n자동 대체 (무료)',     'claude-haiku-4.5\n(경제형)',          '회당 3~100원\n(모델별 상이)'),
        DL('키 없음\n(시뮬레이션)', '무료·오프라인 가능',            '지원 안 됨',                                  '-',                                   '완전 무료'),
    ], [TW*0.15, TW*0.22, TW*0.25, TW*0.20, TW*0.18]))
    items.append(sp(0.1))
    items.append(note('각 엔진 옆 드롭다운에서 모델을 선택하거나 "직접 입력..."을 선택해 원하는 모델 ID를 입력할 수 있습니다.'))

    items += section('2-2  API 키 입력 방법')
    items.append(body('AI 엔진을 선택하면 해당 엔진의 API 키 입력란이 자동으로 표시됩니다.'))
    items.append(sp(0.1))
    items.append(num(1, '엔진 라디오 버튼 선택 → 아래에 API 키 입력란 자동 표시'))
    items.append(num(2, '입력 범위 선택: "이 기기에서 계속 키 사용" (암호화 저장) 또는 "이번에만 키 사용" (세션만 유지)'))
    items.append(num(3, 'API 키를 입력합니다. (OpenAI: sk-... / Gemini: AIzaSy... / Claude: sk-ant-...)'))
    items.append(num(4, '[보기] 버튼으로 입력한 키를 확인할 수 있습니다.'))
    items.append(num(5, '[설정 저장] 버튼 클릭 → 키는 crypto.subtle로 암호화되어 브라우저에만 저장'))
    items.append(sp(0.1))
    items.append(caution('공용 PC에서는 반드시 "이번에만 키 사용"을 선택하세요. '
                           '"이 기기에서 계속 사용"을 선택하면 다른 사람이 같은 PC에서 접속할 때 키가 자동 로드됩니다.'))
    items.append(sp(0.1))

    items += section('2-3  API 키 발급 방법')
    items.append(body('AI 설정 창 내 각 엔진 옆 [🔗 API 키 받으러 가기] 링크를 클릭하면 해당 발급 페이지로 바로 이동합니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('엔진', '발급 사이트', '발급 방법 요약'),
        DL('OpenAI',    'platform.openai.com/api-keys',  '회원가입 → API Keys 메뉴 → [Create new secret key] → 복사'),
        DL('Gemini',    'ai.google.dev',                  'Google 계정 로그인 → [Get API key] → 프로젝트 선택 후 발급'),
        DL('Claude',    'anthropic.com/api',              '회원가입 → [Get API Keys] 또는 Console → [Create Key]'),
    ], [TW*0.15, TW*0.35, TW*0.50]))
    items.append(sp(0.1))
    items.append(note('각 AI 서비스는 첫 가입 시 무료 크레딧을 제공합니다. 소진 후에는 유료 충전이 필요합니다.'))

    items += section('2-4  사용량 및 비용 모니터링')
    items.append(body('AI 설정 창 하단에 "이번 달 추정 비용"이 표시됩니다. '
                       '이 수치는 이 기기에서 사용한 토큰 수를 기반으로 한 추정값이며, '
                       '실제 청구 금액은 각 AI 사 대시보드에서 확인해야 합니다.'))
    items.append(sp(0.1))
    items.append(tip('비용 절감 팁:\n'
                      '- 타자 모드 + 저가형 모델 (gpt-4.1-mini / claude-haiku-4.5): 회당 약 8~10원\n'
                      '- Gemini gemini-2.5-pro: 일정 무료 할당량 제공 (수십 회/일)\n'
                      '- API 키 없이 사용: 완전 무료 (양식 정리만 제공)'))

    return items

# ─────────────────────────────────────────────────
# 3장: 회의 정보 입력
# ─────────────────────────────────────────────────
def ch3():
    items = chapter('3장  회의 정보 입력')

    items += section('3-1  기본 정보')
    items.append(body('화면 왼쪽 입력 패널 상단 "회의 정보" 영역에서 다음 항목을 입력합니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('항목', '입력 방법', '비고'),
        DL('회의명',    '협의회 명칭 입력',                       '협의록 제목 및 파일명으로 사용됨. 예: 교육과정 협의회'),
        DL('날짜',      '날짜 선택기 클릭 → 달력에서 선택',      '오늘 날짜로 자동 설정됨'),
        DL('시작 시간', '시:분 입력',                             '선택 사항. 입력 시 협의록에 포함됨'),
        DL('장소',      '텍스트 직접 입력',                       '예: 교무실, 회의실, 도서관 1층'),
    ], [TW*0.2, TW*0.4, TW*0.4]))
    items.append(sp(0.1))

    items += section('3-2  안건 입력')
    items.append(body('"안건" 섹션에서 이번 회의에서 다룰 안건을 입력합니다. '
                       '안건 내용은 AI가 협의록을 생성할 때 구조화의 기준으로 활용됩니다.'))
    items.append(sp(0.1))
    items.append(num(1, '안건 입력란에 첫 번째 안건을 입력합니다.'))
    items.append(num(2, '[＋ 안건 추가] 버튼을 클릭하면 안건 입력란이 추가됩니다. (여러 안건 등록 가능)'))
    items.append(num(3, '각 안건 입력란 옆 [×] 버튼을 클릭하면 해당 안건을 삭제합니다.'))
    items.append(sp(0.1))
    items.append(note('안건을 명확하게 입력할수록 AI가 협의록을 안건별로 구조화하여 작성합니다.'))
    items.append(sp(0.1))

    items += section('3-3  참석자 입력')
    items.append(body('"참석자" 섹션에서 참석 인원 수를 설정하고 이름을 입력합니다. '
                       '입력한 참석자는 오른쪽 미리보기의 서명란에 실시간으로 반영됩니다.'))
    items.append(sp(0.1))
    items.append(num(1, '[−] 버튼: 참석자 수를 1명 줄입니다. (최소 1명)'))
    items.append(num(2, '[＋] 버튼: 참석자 수를 1명 늘립니다. (최대 16명)'))
    items.append(num(3, '각 칸에 참석자 이름을 입력합니다. (칸당 최대 10자)'))
    items.append(sp(0.05))
    items.append(tbl([
        H('참석자 수', '미리보기 표시 방식'),
        DL('1~8명',   '1행에 모든 참석자가 나란히 표시됨'),
        DL('9~16명',  '자동으로 2행으로 분리: ceil(N/2)명 + floor(N/2)명'),
    ], [TW*0.3, TW*0.7]))
    items.append(sp(0.1))
    items.append(note('이름을 비워두면 "참석자 N" 기본값으로 표시됩니다.'))
    items.append(note('참석자 수를 줄일 때 이미 입력된 이름이 있으면 확인 메시지가 표시됩니다.'))

    return items

# ─────────────────────────────────────────────────
# 4장: 작성 방식
# ─────────────────────────────────────────────────
def ch4():
    items = chapter('4장  작성 방식 선택 및 사용')
    items.append(body('화면 왼쪽 "작성 방식" 섹션에서 4가지 방식 중 하나를 선택합니다. '
                       '한 번에 하나의 방식만 사용 가능합니다. '
                       '방식을 전환하면 이전에 입력한 내용은 해당 모드에 보존됩니다.'))
    items.append(sp(0.15))

    items += subsec('4-1  ⌨ 타자 모드 (기본 추천)')
    items.append(body('회의 내용을 키보드로 직접 입력하는 방식입니다. '
                       '가장 간단하고 즉시 사용 가능하므로 처음 사용자에게 권장합니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('기능', '버튼', '설명'),
        DL('[협의안건] 태그',  '[협의안건] 버튼', '커서 위치에 "[협의안건]" 태그 삽입 → AI가 안건별 결과를 자동 구분'),
        DL('[전달사항] 태그',  '[전달사항] 버튼', '커서 위치에 "[전달사항]" 태그 삽입 → 전달 내용을 별도 구분 정리'),
        DL('받아쓰기',         '[🎤 받아쓰기] 버튼', '브라우저 음성인식 활성화 → 말하면 텍스트로 자동 입력 (Chrome/Edge 지원)'),
        DL('자동 저장',        '자동 동작',       '입력 후 5초 뒤 자동으로 상태 저장. 화면 상단에 "자동 저장됨" 표시'),
        DL('글자 수',          '자동 동작',       '하단에 현재 입력 글자 수 실시간 표시. 20,000자 초과 시 비용 경고'),
    ], [TW*0.22, TW*0.23, TW*0.55]))
    items.append(sp(0.1))
    items.append(tip('입력 예시:\n'
                      '[협의안건] 2학기 수업시수 조정 건\n'
                      '국어 1시간 감축, 창체 1시간 증가로 조정하기로 결정. 담임 교사 전원 동의함.\n'
                      '[전달사항] 다음 주 화요일 교직원 회의 참석 필수 (15:00, 강당)'))
    items.append(sp(0.1))
    items.append(note('태그 없이 자유롭게 입력해도 됩니다. AI가 자동으로 내용을 구조화합니다.'))
    items.append(sp(0.15))

    items += subsec('4-2  🎤 녹음 모드')
    items.append(body('마이크로 회의를 실시간 녹음하거나, 미리 녹음해 둔 오디오 파일을 텍스트로 변환합니다.'))
    items.append(sp(0.1))
    items.append(Paragraph('▶ 실시간 녹음 탭', SS['cell_lb']))
    items.append(sp(0.05))
    items.append(num(1, '마이크 연결 상태 확인: "마이크 연결됨 ✓" 메시지 확인'))
    items.append(num(2, '[녹음 시작] 버튼 클릭 → 오디오 레벨 바로 음량 시각화'))
    items.append(num(3, '회의 진행 — 브라우저 음성인식이 자동으로 실시간 텍스트 변환'))
    items.append(num(4, '[녹음 정지] 버튼 클릭 → 완성된 STT 텍스트 편집 영역에 표시'))
    items.append(num(5, '녹음 종료 후 [⬇ 녹음 파일 다운로드] 버튼으로 오디오 파일 보관 가능'))
    items.append(sp(0.05))
    items.append(tbl([
        H('항목', '내용'),
        DL('최대 녹음 시간', '3시간 (10,800초). 초과 시 자동 정지.'),
        DL('화면 꺼짐 방지', '녹음 중 브라우저 Wake Lock 기능으로 화면 꺼짐 방지 (지원 환경에서)'),
        DL('STT 정확도',     '브라우저 기본 음성인식 사용 (무료). 잡음 많을수록 정확도 저하.'),
        DL('파일 형식',      'WebM 또는 OGG 포맷으로 저장됨'),
    ], [TW*0.3, TW*0.7]))
    items.append(sp(0.1))
    items.append(Paragraph('▶ 파일 첨부 탭 (고품질 STT 변환)', SS['cell_lb']))
    items.append(sp(0.05))
    items.append(num(1, '파일 첨부 탭 클릭 → 오디오 파일을 드래그하거나 클릭하여 업로드'))
    items.append(num(2, 'STT 엔진 선택: Whisper (OpenAI 키 필요) 또는 Gemini 오디오 (Gemini 키 필요)'))
    items.append(num(3, '[텍스트 변환] 버튼 클릭 → 변환 완료 후 STT 결과 텍스트 표시'))
    items.append(num(4, '오인식된 내용을 수정한 뒤 [협의록 생성] 진행'))
    items.append(sp(0.05))
    items.append(tbl([
        H('STT 엔진', '지원 파일', '제한', '필요 키'),
        DL('Whisper (OpenAI)', 'MP3, M4A, WAV, WebM, OGG', '25MB 이하',              'OpenAI API 키'),
        DL('Gemini 오디오',    'MP3, M4A, WAV, WebM, OGG', '파일 크기 제한 덜 엄격', 'Gemini API 키'),
    ], [TW*0.28, TW*0.25, TW*0.22, TW*0.25]))
    items.append(sp(0.1))
    items.append(note('Whisper는 정확도가 높고, Gemini는 대용량 파일에 유리합니다.'))
    items.append(note('Claude 엔진 선택 시 파일 STT는 Whisper 또는 Gemini로 선택해야 합니다 (Claude는 오디오 미지원).'))
    items.append(sp(0.15))

    items += subsec('4-3  📄 계획서 모드')
    items.append(body('기존에 작성된 계획서나 문서 파일을 업로드하여 내용을 자동 추출합니다. '
                       '추출된 텍스트를 기반으로 AI가 협의록을 생성합니다.'))
    items.append(sp(0.1))
    items.append(num(1, '파일을 드래그하거나 업로드 영역을 클릭하여 파일을 선택합니다.'))
    items.append(num(2, '여러 파일을 동시에 올릴 수 있습니다. (텍스트가 순서대로 합쳐집니다)'))
    items.append(num(3, '추출된 텍스트가 편집 가능한 영역에 표시됩니다. 불필요한 내용 삭제 가능.'))
    items.append(num(4, '직접 계획서 내용을 텍스트 영역에 붙여넣기해도 됩니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('파일 형식', '지원 방법', '주의사항'),
        DL('HWPX',  '한글(.hwpx) 최신 형식 지원.\nJSZip으로 XML 파싱.',
                    '구형 .hwp는 지원 안 됨. 한글에서 [파일→다른 이름으로 저장→.hwpx] 후 업로드.'),
        DL('PDF',   'pdf.js 라이브러리로 텍스트 추출.',
                    '텍스트 PDF만 지원. 이미지로 스캔된 PDF는 텍스트 추출 불가.'),
        DL('DOCX',  'mammoth.js로 본문 텍스트 추출.',
                    '서식(색상·이미지)은 제거되고 순수 텍스트만 추출됨.'),
    ], [TW*0.15, TW*0.38, TW*0.47]))
    items.append(sp(0.1))
    items.append(caution('파일 업로드가 안 되거나 추출에 실패하면 한글에서 내용을 복사하여 텍스트 영역에 직접 붙여넣기를 사용하세요.'))
    items.append(sp(0.15))

    items += subsec('4-4  ✏ 펜 모드 (손글씨 OCR)')
    items.append(body('터치스크린이나 마우스로 직접 손글씨를 입력하고, '
                       'AI OCR로 텍스트를 추출합니다. 태블릿 환경에 적합합니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('도구/기능', '설명'),
        DL('✏ 펜',           '드로잉 모드. 굵기(1~12) 및 색상 선택 가능.'),
        DL('🧽 지우개',       '특정 부분 지우기'),
        DL('↩ 실행취소',     '마지막 필기 선 취소'),
        DL('↪ 다시 실행',    '취소한 선 복구'),
        DL('🗑 전체 지우기', '캔버스 전체 초기화'),
        DL('텍스트 추출(OCR)', '[텍스트 추출 (OCR)] 버튼 클릭 → 선택한 AI 엔진이 손글씨를 텍스트로 변환'),
        DL('손바닥 오터치 방지', '체크 시 터치 입력만 인식 (펜 전용 모드). 손바닥 실수 터치 방지.'),
    ], [TW*0.3, TW*0.7]))
    items.append(sp(0.1))
    items.append(note('OCR 결과는 정확하지 않을 수 있습니다. 추출 후 수정하고 협의록 생성을 진행하세요.'))
    items.append(note('AI 키가 없으면 OCR 기능을 사용할 수 없습니다.'))

    return items

# ─────────────────────────────────────────────────
# 5장: 협의록 생성
# ─────────────────────────────────────────────────
def ch5():
    items = chapter('5장  협의록 생성')

    items += section('5-1  생성 절차')
    items.append(body('회의 정보와 내용 입력이 완료되면 [협의록 생성 →] 버튼을 클릭합니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('단계', '내용', '비고'),
        DL('1. 버튼 클릭',    '[협의록 생성 →] 버튼 클릭',                         '하단 생성 힌트 문구 확인'),
        DL('2. 비용 확인 팝업', '사용 엔진, 예상 비용, AI 전송 안내 표시',           '키 없음 모드는 팝업 없음'),
        DL('3. 생성 확인',    '[생성하기] 클릭 → AI 서버로 입력 텍스트 전송',        '취소 시 [취소] 클릭'),
        DL('4. 생성 완료',    '오른쪽 미리보기 패널에 협의록 본문 자동 표시',         '보통 5~30초 소요'),
        DL('5. 자동 저장',    '생성된 협의록이 보관함에 자동 저장됨',                ''),
    ], [TW*0.2, TW*0.35, TW*0.45]))
    items.append(sp(0.1))
    items.append(note('"키 없음(로컬 시뮬레이션)" 모드에서는 AI 없이 입력 내용을 학교 공문 양식으로만 정리합니다.'))

    items += section('5-2  AI 자동 후처리 (모든 엔진 공통 적용)')
    items.append(body('AI 응답은 학교 공문 양식에 맞게 자동 후처리됩니다. '
                       '별도로 편집하지 않아도 일관된 형식으로 출력됩니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('후처리 항목', '변환 내용'),
        DL('마크다운 제거',      '#, **, *, ```, - 등 마크다운 기호 자동 제거'),
        DL('빈 섹션 제거',       '내용 없는 [섹션] 태그 자동 삭제'),
        DL('번호 체계 정규화',   '①→1., (1)→1., (가)→가. 형식으로 통일'),
        DL('어미 변환',          '합니다→함, 됩니다→됨, 예정입니다→예정임, 바랍니다→바람 (공문체)'),
        DL('들여쓰기 정리',      '가~하. 항목: 2칸 들여쓰기, - 항목: 4칸 들여쓰기'),
        DL('빈 줄 정리',         '연속 3줄 이상 빈 줄을 최대 1줄로 축소'),
    ], [TW*0.3, TW*0.7]))
    items.append(sp(0.1))
    items.append(note('미리보기 영역의 협의록 내용은 현재 직접 편집이 지원되지 않습니다. '
                       '내용 수정이 필요하면 엑셀/워드로 다운로드 후 편집하거나, '
                       '입력 내용을 수정 후 다시 생성하세요.'))

    return items

# ─────────────────────────────────────────────────
# 6장: 내보내기
# ─────────────────────────────────────────────────
def ch6():
    items = chapter('6장  내보내기')

    items += section('6-1  인쇄')
    items.append(body('협의록을 A4 용지에 인쇄합니다. 제목·일시·장소·참석자 서명란·안건·회의 내용이 포함된 완성 양식이 출력됩니다.'))
    items.append(sp(0.1))
    items.append(num(1, '미리보기 영역 상단 [🖨 인쇄] 버튼 클릭'))
    items.append(num(2, '브라우저 인쇄 대화상자 → 용지: A4 / 방향: 세로 / 여백: 최소'))
    items.append(num(3, '"배경 그래픽" 옵션을 체크하면 표 테두리가 올바르게 인쇄됩니다.'))
    items.append(sp(0.1))
    items.append(note('태블릿에서 미리보기 탭이 숨겨져 있어도 인쇄 CSS가 적용되어 올바른 양식으로 출력됩니다.'))

    items += section('6-2  엑셀 다운로드')
    items.append(body('협의록을 엑셀 파일로 저장합니다. 다운로드 후 자유롭게 편집·공유할 수 있습니다.'))
    items.append(sp(0.1))
    items.append(num(1, '협의록 생성 후 상단 도구바의 [📊 엑셀 다운로드] 버튼 활성화됨'))
    items.append(num(2, '버튼 클릭 → 파일명: "회의명_날짜.xlsx" 형식으로 자동 저장'))
    items.append(num(3, '엑셀에서 내용 수정·서식 변경·공유 가능'))
    items.append(sp(0.1))
    items.append(note('협의록 생성 전에는 버튼이 비활성화(회색)로 표시됩니다.'))

    items += section('6-3  워드(.doc) 다운로드')
    items.append(body('협의록을 워드 파일로 저장합니다. Microsoft Word 및 한글(HWP)에서 직접 열어 편집할 수 있습니다.'))
    items.append(sp(0.1))
    items.append(num(1, '미리보기 영역에서 워드 다운로드 버튼 클릭'))
    items.append(num(2, '파일명: "회의명_날짜.doc" 형식으로 자동 저장'))
    items.append(num(3, 'Microsoft Word에서 열어 서식·내용 자유 편집 가능'))
    items.append(sp(0.1))
    items.append(tbl([
        H('포함 항목', '내용'),
        DL('회의명',   '제목 행에 큰 글씨로 표시'),
        DL('일시·장소','한 행에 함께 표시'),
        DL('참석자',   '이름 행 + 서명 빈칸 행 (4명씩)'),
        DL('안건',     '번호 목록으로 정리'),
        DL('회의내용', '줄바꿈 유지, 충분한 공간 제공'),
    ], [TW*0.25, TW*0.75]))
    items.append(sp(0.1))
    items.append(note('.doc 형식은 HTML 기반으로 생성됩니다. Word 열 때 "이 형식을 지원하나요?" 경고가 나타날 수 있으나 정상입니다.'))

    return items

# ─────────────────────────────────────────────────
# 7장: 보관함
# ─────────────────────────────────────────────────
def ch7():
    items = chapter('7장  보관함 활용')

    items += section('7-1  자동 저장')
    items.append(body('협의록이 생성되면 브라우저 내부 저장소(IndexedDB)에 자동으로 저장됩니다. '
                       '인터넷 연결 없이도 이전 협의록을 조회할 수 있습니다.'))
    items.append(sp(0.1))
    items.append(warn('⚠ 주의: 브라우저 캐시·사이트 데이터를 삭제하면 보관된 협의록도 함께 삭제됩니다!\n'
                       '중요한 협의록은 반드시 엑셀 또는 워드로 다운로드해 별도 보관하세요.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('저장 위치', '특징', '삭제 조건'),
        DL('브라우저 IndexedDB', '기기 내부 저장. 용량 제한 없음.', '브라우저 데이터 삭제 또는 [새로작성] 시 현재 작업 초기화'),
        DL('보관함 폴더',         '지정한 로컬 폴더에 파일 저장.',   '파일 직접 삭제 시'),
    ], [TW*0.25, TW*0.37, TW*0.38]))

    items += section('7-2  협의록 불러오기')
    items.append(num(1, '상단 도구바 [📂 협의록 불러오기] 클릭'))
    items.append(num(2, '보관함 팝업에서 회의명·안건·일시로 검색 가능'))
    items.append(num(3, '원하는 협의록을 클릭하면 모든 입력 정보와 협의록 내용이 복원됩니다.'))
    items.append(sp(0.1))
    items.append(note('보관함은 브라우저별로 독립 저장됩니다. 다른 브라우저·기기에서는 동일한 보관함이 표시되지 않습니다.'))

    items += section('7-3  보관함 폴더 지정 및 클라우드 백업')
    items.append(body('PC의 구글 드라이브 또는 원드라이브 동기화 폴더를 보관함으로 지정하면 '
                       '협의록이 자동으로 클라우드에 백업됩니다.'))
    items.append(sp(0.1))
    items.append(tbl([
        H('클라우드', '설정 방법'),
        DL('구글 드라이브',
           'Google Drive for Desktop 설치(google.com/drive/download) → PC에 드라이브 폴더 생성 → '
           '이 앱에서 [📁 보관함 폴더 지정] → 드라이브 폴더 선택 → 이후 생성 시 자동 클라우드 업로드'),
        DL('원드라이브 (OneDrive)',
           'Windows 기본 OneDrive 로그인 → OneDrive 폴더 확인(예: C:\\Users\\사용자\\OneDrive) → '
           '이 앱에서 [📁 보관함 폴더 지정] → OneDrive 폴더 선택 → 이후 생성 시 자동 클라우드 업로드'),
    ], [TW*0.23, TW*0.77]))
    items.append(sp(0.1))
    items.append(caution('폴더 지정 기능은 데스크톱 Chrome/Edge에서만 지원됩니다. '
                           '모바일·태블릿에서는 다운로드 폴더에 저장됩니다.'))
    items.append(sp(0.05))
    items.append(tip('클라우드 폴더를 보관함으로 지정하면:\n'
                      '- PC 고장이나 브라우저 데이터 삭제 시에도 협의록이 안전하게 보존됩니다.\n'
                      '- 휴대폰·다른 PC에서 드라이브 앱으로 협의록 파일을 열람할 수 있습니다.\n'
                      '- 협의록 데이터가 개발자 서버를 거치지 않아 안전합니다.'))
    items.append(sp(0.05))
    items.append(info('[❓] 버튼(도구바의 물음표 아이콘)을 클릭하면 클라우드 연동 안내를 자세하게 볼 수 있습니다.'))

    return items

# ─────────────────────────────────────────────────
# 8장: FAQ
# ─────────────────────────────────────────────────
def ch8():
    items = chapter('8장  자주 묻는 질문 (FAQ)')

    faqs = [
        ('API 키가 없어도 사용할 수 있나요?',
         'AI 설정에서 "키 없음(로컬 시뮬레이션)"을 선택하면 API 키 없이도 사용 가능합니다. '
         'AI 없이 입력한 내용을 학교 협의록 양식으로 정리해 줍니다. '
         '단, 자연스러운 문체로 내용을 구조화하는 AI 기능은 사용할 수 없습니다.'),

        ('협의록 생성 후 오른쪽 미리보기에 안 보여요.',
         '태블릿이나 소형 화면의 경우 화면 상단의 탭 버튼 중 "2쪽 미리보기"를 클릭하면 확인할 수 있습니다. '
         '데스크톱에서 보이지 않는다면 브라우저를 새로고침(F5)하고 다시 생성해 보세요.'),

        ('녹음 중 화면이 꺼질 것 같아요.',
         '녹음 모드 실행 시 브라우저 Wake Lock 기능이 활성화되어 화면이 꺼지는 것을 방지합니다. '
         '일부 환경(파이어폭스, 구형 브라우저)에서는 지원되지 않을 수 있으니 장시간 녹음 시 전원을 연결해 두세요.'),

        ('한글(.hwp) 파일은 업로드가 안 되나요?',
         '구형 .hwp 형식은 지원하지 않습니다. 한글 프로그램에서 [파일 → 다른 이름으로 저장]을 선택한 후 '
         '파일 형식을 .hwpx로 변경하여 저장한 뒤 업로드해 주세요.'),

        ('협의록 내용을 직접 수정하고 싶어요.',
         '현재 버전에서는 미리보기 영역의 내용을 직접 편집하는 기능이 없습니다. '
         '엑셀 또는 워드로 다운로드한 후 수정하거나, '
         '타자 모드에서 내용을 수정 후 다시 생성하는 방법을 사용하세요.'),

        ('새 브라우저로 접속했더니 이전 협의록이 없어요.',
         '보관함은 브라우저별로 독립 저장됩니다. 이전에 사용한 브라우저에서 접속해야 저장된 협의록을 볼 수 있습니다. '
         '다른 기기나 브라우저에서도 사용하려면 엑셀/워드 파일로 백업하거나 클라우드 폴더를 보관함으로 지정하세요 (7장 참조).'),

        ('참석자 서명란에 서명을 직접 입력할 수 있나요?',
         '현재 버전에서 미리보기의 서명란은 인쇄 후 직접 서명하는 방식을 기본으로 합니다. '
         '엑셀 또는 워드로 다운로드하면 서명란 셀에 직접 입력할 수 있습니다.'),

        ('모바일(스마트폰)에서도 사용 가능한가요?',
         '크롬 모바일 브라우저에서 접속하면 기본 기능(정보 입력, 협의록 생성, 저장)은 사용 가능합니다. '
         '단, 보관함 폴더 지정 기능은 모바일에서 지원되지 않으며, '
         '화면이 작아 입력이 불편할 수 있습니다. 태블릿이나 PC 환경을 권장합니다.'),
    ]

    for i, (q, a) in enumerate(faqs):
        items.append(sp(0.05 if i > 0 else 0))
        q_data = [[Paragraph(f'Q{i+1}.  {q}', SS['sec'])]]
        q_tbl = Table(q_data, colWidths=[TW])
        q_tbl.setStyle(TableStyle([
            ('TOPPADDING',    (0,0), (-1,-1), 2),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('LEFTPADDING',   (0,0), (-1,-1), 0),
        ]))
        items.append(q_tbl)
        items.append(Paragraph(f'     {a}', SS['body']))
        items.append(sp(0.05))
        items.append(HRFlowable(width='100%', thickness=0.3, color=LINE))

    return items

# ─────────────────────────────────────────────────
# 9장: 개인정보·보안
# ─────────────────────────────────────────────────
def ch9():
    items = chapter('9장  개인정보 및 보안 안내')

    items += section('9-1  데이터 저장 정책')
    items.append(tbl([
        H('데이터 종류', '저장 위치', '외부 전송 여부'),
        DL('회의 입력 내용 (타자·녹음·계획서·펜)',
           '브라우저 IndexedDB·OPFS (사용자 기기)', '❌ 미전송'),
        DL('녹음 파일',
           '브라우저 메모리 (다운로드 시 기기에 저장)', '❌ 미전송'),
        DL('참석자 이름·회의 정보',
           '브라우저 IndexedDB (사용자 기기)', '❌ 미전송'),
        DL('AI 협의록 생성 시 입력 텍스트',
           '요청 시 선택한 AI 서버로 일시 전송', '⚠ 전송 (AI 생성 시에만)'),
        DL('API 키',
           'crypto.subtle 암호화 후 IndexedDB에 저장', '❌ 미전송 (암호화 보관)'),
    ], [TW*0.35, TW*0.38, TW*0.27]))
    items.append(sp(0.1))
    items.append(warn('⚠ AI 협의록 생성 시에만 입력 텍스트가 외부 AI 서버(OpenAI·Google·Anthropic)로 전송됩니다.\n'
                       '학생 개인정보(이름·성적·주민번호 등)가 포함되지 않도록 반드시 주의하세요.'))
    items.append(sp(0.1))

    items += section('9-2  API 키 보안')
    items.append(tbl([
        H('보안 항목', '내용'),
        DL('암호화 방식',   'Web Crypto API (crypto.subtle)로 암호화하여 브라우저 IndexedDB에만 저장'),
        DL('평문 저장 금지','API 키는 절대로 localStorage에 평문으로 저장되지 않습니다'),
        DL('서버 미전송',   'API 키는 개발자 서버로 전송되지 않습니다. 브라우저에서 AI API를 직접 호출합니다'),
        DL('세션 옵션',     '"이번에만 키 사용" 선택 시 브라우저를 닫으면 키가 자동 삭제됩니다'),
    ], [TW*0.28, TW*0.72]))
    items.append(sp(0.1))

    items += section('9-3  개인정보 보호 수칙')
    items.append(bul('학생 이름, 성적, 주민번호 등 개인정보는 회의 내용에 포함하지 마세요.'))
    items.append(bul('녹음 시작 전 반드시 참석자 전원의 동의를 받으세요.'))
    items.append(bul('API 키를 타인과 공유하지 마세요. 유출 시 과금 피해가 발생할 수 있습니다.'))
    items.append(bul('공용 PC에서는 "이번에만 키 사용" 옵션을 선택하세요.'))
    items.append(bul('협의록 다운로드 파일은 학교 문서 보안 정책에 따라 관리하세요.'))
    items.append(bul('브라우저 캐시 삭제 전 중요한 협의록을 반드시 파일로 저장해 두세요.'))
    items.append(sp(0.1))

    items += section('9-4  책임 한계')
    items.append(body('본 프로그램은 교사 개인이 무료로 개발·배포하는 서비스입니다. '
                       '데이터 손실, API 키 유출, AI 생성 오류, 서비스 중단 등에 대해 '
                       '개발자는 법적 책임을 지지 않습니다. '
                       '학교 업무에 활용 시 AI 생성 내용을 반드시 검토·수정하여 사용하시기 바랍니다.'))
    items.append(sp(0.15))
    items.append(info('문의 · 버그 신고: GitHub Issues 또는 개발자에게 직접 문의\n'
                       '이 설명서는 2026년 6월 기준 학교 협의록 작성기 v1.0에 맞게 작성되었습니다.'))

    return items

# ─────────────────────────────────────────────────
# 문서 조립 및 출력
# ─────────────────────────────────────────────────
OUTPUT = ('C:/Users/user/Desktop/2026 연구학교 관련/'
          'warp-project/anti-conver/학교_협의록_작성기_사용설명서.pdf')

doc = Doc(OUTPUT)

story = []

# 표지 (cover 템플릿)
story.append(NextPageTemplate('cover'))
story += make_cover()

# 본문 첫 페이지: 한장 요약 (body 템플릿으로 전환)
story.append(NextPageTemplate('body'))
story.append(PageBreak())
story += make_quickstart()

# 각 장
story += ch1()
story += ch2()
story += ch3()
story += ch4()
story += ch5()
story += ch6()
story += ch7()
story += ch8()
story += ch9()

doc.build(story)
print(f'[완료] PDF 생성 완료: {OUTPUT}')
