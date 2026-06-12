import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { getUserInfoFromLocalStorage } from './Components/authUtils';
import './styles/TimetablePage.css';

const HOURS  = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const DAYS   = ['월', '화', '수', '목', '금', '토', '일'];
const COLORS = ['#FEE500', '#1677ff', '#ff4d4f', '#52c41a', '#722ed1', '#fa8c16'];
const EMPTY_FORM = { title: '', color: COLORS[0], startHour: 9, endHour: 10, memo: '' };

const pad = n => String(n).padStart(2, '0');

function getBlockStyle(block) {
  if (!block) return {};
  const c = block.color || '#FEE500';
  const style = {
    background: c + '33',
    borderLeft: `2px solid ${c}`,
    borderRight: `2px solid ${c}`,
    cursor: 'pointer',
    boxSizing: 'border-box',
  };
  if (block.isFirst) {
    style.borderTop = `2px solid ${c}`;
    style.borderTopLeftRadius = '6px';
    style.borderTopRightRadius = '6px';
  } else {
    style.borderTop = 'none';
  }
  if (block.isLast) {
    style.borderBottom = `2px solid ${c}`;
    style.borderBottomLeftRadius = '12px';
    style.borderBottomRightRadius = '12px';
  } else {
    style.borderBottom = 'none';
  }
  return style;
}

export default function TimetablePage() {
  const userInfo = getUserInfoFromLocalStorage();
  const userId   = userInfo?.id;

  const [timetable, setTimetable] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [modal,     setModal]     = useState({ open: false, mode: 'add', dayIdx: 0, entry: null });
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [dragSel,   setDragSel]   = useState(null);
  const dragRef = useRef({ isDown: false, dayIdx: null, startHour: null, curHour: null });

  const todayIdx = (new Date().getDay() + 6) % 7;

  const fetchTimetable = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/timetable?kakaoId=${userId}`);
      setTimetable(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchTimetable(); }, [fetchTimetable]);

  useEffect(() => {
    const onMouseUp = () => {
      const dr = dragRef.current;
      if (!dr.isDown) return;
      const startH = Math.min(dr.startHour, dr.curHour ?? dr.startHour);
      const endH   = Math.max(dr.startHour, dr.curHour ?? dr.startHour) + 1;
      const dayIdx = dr.dayIdx;
      dragRef.current = { isDown: false, dayIdx: null, startHour: null, curHour: null };
      setDragSel(null);
      setModal({ open: true, mode: 'add', dayIdx, entry: null });
      setForm({ ...EMPTY_FORM, startHour: startH, endHour: Math.min(endH, 23) });
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  const blockMap = useMemo(() => {
    const map = {};
    timetable.forEach(entry => {
      const startH = parseInt(entry.start_time.split(':')[0]);
      const endH   = parseInt(entry.end_time.split(':')[0]);
      for (let h = startH; h < endH; h++) {
        if (h < 7 || h > 22) continue;
        if (!map[entry.day_of_week]) map[entry.day_of_week] = {};
        map[entry.day_of_week][h] = { ...entry, isFirst: h === startH, isLast: h === endH - 1 };
      }
    });
    return map;
  }, [timetable]);

  const handleCellMouseDown = (e, dayIdx, hour, block) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (block) {
      const startH = parseInt(block.start_time.split(':')[0]);
      const endH   = parseInt(block.end_time.split(':')[0]);
      setModal({ open: true, mode: 'edit', dayIdx: block.day_of_week, entry: block });
      setForm({ title: block.title, color: block.color || COLORS[0], startHour: startH, endHour: endH, memo: block.memo || '' });
      return;
    }
    dragRef.current = { isDown: true, dayIdx, startHour: hour, curHour: hour };
    setDragSel({ dayIdx, minHour: hour, maxHour: hour });
  };

  const handleCellMouseEnter = (dayIdx, hour) => {
    if (!dragRef.current.isDown || dragRef.current.dayIdx !== dayIdx) return;
    dragRef.current.curHour = hour;
    const minH = Math.min(dragRef.current.startHour, hour);
    const maxH = Math.max(dragRef.current.startHour, hour);
    setDragSel({ dayIdx, minHour: minH, maxHour: maxH });
  };

  const isDragCell = (dayIdx, hour) =>
    dragSel && dayIdx === dragSel.dayIdx && hour >= dragSel.minHour && hour <= dragSel.maxHour;

  const handleSave = async () => {
    if (!form.title.trim() || !userId || form.endHour <= form.startHour) return;
    setSaving(true);
    try {
      const payload = {
        kakao_id:    userId,
        title:       form.title.trim(),
        color:       form.color,
        day_of_week: modal.dayIdx,
        start_time:  `${pad(form.startHour)}:00`,
        end_time:    `${pad(form.endHour)}:00`,
        memo:        form.memo,
      };
      if (modal.mode === 'edit' && modal.entry) {
        await axios.put(`/api/timetable?id=${modal.entry.id}`, payload);
      } else {
        await axios.post('/api/timetable', payload);
      }
      await fetchTimetable();
      setModal(m => ({ ...m, open: false }));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!modal.entry || !userId) return;
    setSaving(true);
    try {
      await axios.delete(`/api/timetable?id=${modal.entry.id}&kakaoId=${userId}`);
      await fetchTimetable();
      setModal(m => ({ ...m, open: false }));
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateForm = patch => setForm(f => ({ ...f, ...patch }));

  const endHourOptions = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
    .filter(h => h > form.startHour);

  if (!userInfo) {
    return (
      <div className="tt-page">
        <div className="tt-login-msg">카카오 로그인 후 이용할 수 있어요.</div>
      </div>
    );
  }

  return (
    <div className="tt-page">
      <div className="tt-top">
        <h2 className="tt-title">📋 내 시간표</h2>
        <p className="tt-subtitle">
          매주 반복되는 나의 일정을 등록하세요. 모임 일정 등록 시 해당 시간을 자동으로 막아드려요.
        </p>
      </div>

      {loading ? (
        <div className="tt-loading"><div className="tt-spinner" /><span>불러오는 중...</span></div>
      ) : (
        <div className="tt-grid-outer">
          <div className="tt-grid-wrap">
            <div className="tt-corner" />
            {DAYS.map((day, i) => (
              <div
                key={i}
                className={`tt-day-header${i === todayIdx ? ' today' : ''}${i === 5 ? ' saturday' : i === 6 ? ' sunday' : ''}`}
              >
                {day}
              </div>
            ))}

            {HOURS.map(hour => (
              <React.Fragment key={hour}>
                <div className="tt-time-label">{`${pad(hour)}:00`}</div>
                {DAYS.map((_, dayIdx) => {
                  const block = blockMap[dayIdx]?.[hour];
                  const drag  = isDragCell(dayIdx, hour);
                  let cls = 'tt-cell';
                  if (drag)  cls += ' tt-cell-drag';
                  if (block) cls += ' tt-cell-block';
                  if (dayIdx === todayIdx) cls += ' col-today';
                  return (
                    <div
                      key={dayIdx}
                      className={cls}
                      style={block ? getBlockStyle(block) : {}}
                      onMouseDown={e => handleCellMouseDown(e, dayIdx, hour, block)}
                      onMouseEnter={() => handleCellMouseEnter(dayIdx, hour)}
                    >
                      {block?.isFirst && (
                        <span className="tt-block-label">{block.title}</span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <p className="tt-hint">셀을 드래그하여 일정을 추가하고, 기존 일정을 클릭하면 수정할 수 있어요.</p>

      {modal.open && (
        <div
          className="tt-overlay"
          onMouseDown={e => { if (e.target === e.currentTarget) setModal(m => ({ ...m, open: false })); }}
        >
          <div className="tt-modal">
            <div className="tt-modal-head">
              <h3>{modal.mode === 'edit' ? '일정 수정' : '일정 추가'}</h3>
              <button className="tt-close" onClick={() => setModal(m => ({ ...m, open: false }))}>✕</button>
            </div>

            <div className="tt-modal-body">
              <div className="tt-field">
                <label>요일</label>
                <span className="tt-day-badge">{DAYS[modal.dayIdx]}요일</span>
              </div>

              <div className="tt-field">
                <label>제목 <span className="tt-req">*</span></label>
                <input
                  className="tt-input"
                  value={form.title}
                  onChange={e => updateForm({ title: e.target.value })}
                  placeholder="예: 영어 수업"
                  maxLength={30}
                  autoFocus
                />
              </div>

              <div className="tt-field">
                <label>색상</label>
                <div className="tt-colors">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`tt-color-dot${form.color === c ? ' sel' : ''}`}
                      style={{ background: c }}
                      onClick={() => updateForm({ color: c })}
                    />
                  ))}
                </div>
              </div>

              <div className="tt-field">
                <label>시간</label>
                <div className="tt-time-row">
                  <select
                    className="tt-select"
                    value={form.startHour}
                    onChange={e => {
                      const v = parseInt(e.target.value);
                      updateForm({ startHour: v, endHour: form.endHour > v ? form.endHour : v + 1 });
                    }}
                  >
                    {HOURS.map(h => <option key={h} value={h}>{`${pad(h)}:00`}</option>)}
                  </select>
                  <span className="tt-tilde">~</span>
                  <select
                    className="tt-select"
                    value={form.endHour}
                    onChange={e => updateForm({ endHour: parseInt(e.target.value) })}
                  >
                    {endHourOptions.map(h => <option key={h} value={h}>{`${pad(h)}:00`}</option>)}
                  </select>
                </div>
              </div>

              <div className="tt-field">
                <label>메모</label>
                <textarea
                  className="tt-textarea"
                  value={form.memo}
                  onChange={e => updateForm({ memo: e.target.value })}
                  placeholder="선택 사항"
                  rows={2}
                />
              </div>
            </div>

            <div className="tt-modal-foot">
              {modal.mode === 'edit' && (
                <button className="tt-btn-del" onClick={handleDelete} disabled={saving}>삭제</button>
              )}
              <div className="tt-foot-right">
                <button className="tt-btn-cancel" onClick={() => setModal(m => ({ ...m, open: false }))}>
                  취소
                </button>
                <button
                  className="tt-btn-save"
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || form.endHour <= form.startHour}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
