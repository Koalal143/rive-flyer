import React, { useEffect, useRef, useState } from 'react';
import { hasCompletedSurvey, submitOfferSurvey } from './analytics.js';
import './survey.css';

const questions = [
  {
    title: 'Если бы предложение действовало, что могло бы вас побудить зайти в магазин РИВ ГОШ?',
    field: 'motivations',
    options: [
      ['gift', 'Бальзам в подарок'],
      ['selection', 'Товар или цена из подборки'],
      ['on_the_way', 'Магазин по пути'],
      ['none', 'Ничего из перечисленного'],
      ['other', 'Другое'],
    ],
  },
  {
    title: 'Что скорее всего помешало бы вам зайти?',
    field: 'barriers',
    options: [
      ['in_a_hurry', 'Спешу'],
      ['out_of_the_way', 'Магазин не по пути'],
      ['gift_uninteresting', 'Подарок неинтересен'],
      ['no_cosmetics_needed', 'Сейчас не нужна косметика'],
      ['unclear_terms', 'Условия непонятны'],
      ['none', 'Ничего не помешало бы'],
    ],
  },
  { title: 'Как вы бы поняли, что нужно сделать, чтобы получить бальзам?', field: 'clarity' },
  { title: 'Что из подборки товаров или цен запомнилось, если что-то запомнилось?', field: 'recall_text' },
];

const recallOptions = [
  ['nothing', 'Ничего'],
  ['did_not_view', 'Не смотрел подборку'],
];

const emptyAnswers = {
  motivations: [],
  barriers: [],
  motivation_other: '',
  clarity: '',
  recall_kind: 'text',
  recall_text: '',
};

export function OfferSurvey() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [completed, setCompleted] = useState(hasCompletedSurvey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const stepHeading = useRef(null);
  const question = questions[step];
  const lastStep = step === questions.length - 1;
  const hasOther = step === 0 && answers.motivations.includes('other');

  useEffect(() => {
    if (step >= 0) stepHeading.current?.focus();
  }, [step, completed]);

  function update(field, value) {
    setAnswers(previous => ({ ...previous, [field]: value }));
  }

  function toggleOption(field, option, checked) {
    setAnswers(previous => {
      const selected = previous[field];
      const next = !checked ? selected.filter(value => value !== option)
        : option === 'none' ? [option] : [...selected.filter(value => value !== 'none'), option];
      return { ...previous, [field]: next };
    });
  }

  const ready = question?.options
    ? answers[question.field].length > 0 && (!hasOther || Boolean(answers.motivation_other.trim()))
    : lastStep
      ? answers.recall_kind !== 'text' || Boolean(answers.recall_text.trim())
      : Boolean(answers.clarity.trim());

  async function advance(event) {
    event.preventDefault();
    if (!ready || busy) return;
    setError(false);
    if (!lastStep) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await submitOfferSurvey({
        ...answers,
        motivation_other: answers.motivations.includes('other') ? answers.motivation_other.trim() : '',
        clarity: answers.clarity.trim(),
        recall_text: answers.recall_kind === 'text' ? answers.recall_text.trim() : '',
      });
      setCompleted(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap section offer-survey" aria-labelledby="offer-survey-title">
      <h2 id="offer-survey-title" className={question || completed ? 'visually-hidden' : undefined}>
        Как вы относитесь к нашему предложению?
      </h2>
      {completed ? (
        <p className="offer-survey-thanks" ref={stepHeading} tabIndex={-1} role="status">Спасибо за ответы!</p>
      ) : !question ? (
        <div className="offer-survey-intro">
          <p>4 вопроса</p>
          <button type="button" className="button button-dark" onClick={() => setStep(0)}>Начать опрос</button>
        </div>
      ) : (
        <form onSubmit={advance} aria-busy={busy}>
          <p className="offer-survey-progress" id="offer-survey-progress">Вопрос {step + 1} из {questions.length}</p>
          <progress value={step + 1} max={questions.length} aria-labelledby="offer-survey-progress" />
          <div key={step} className="offer-survey-step">
            <h3 id="offer-survey-question" ref={stepHeading} tabIndex={-1}>{question.title}</h3>
            {question.options ? (
              <fieldset aria-labelledby="offer-survey-question" disabled={busy}>
                <p className="offer-survey-hint">Можно выбрать несколько вариантов</p>
                <div className="offer-survey-options">
                  {question.options.map(([id, label]) => (
                    <label className="offer-survey-option" key={id}>
                      <input type="checkbox" checked={answers[question.field].includes(id)}
                        onChange={event => toggleOption(question.field, id, event.target.checked)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {hasOther && (
                  <label className="offer-survey-other">
                    Что ещё могло бы вас побудить?
                    <input type="text" value={answers.motivation_other} maxLength={250}
                      onChange={event => update('motivation_other', event.target.value)} />
                  </label>
                )}
              </fieldset>
            ) : (
              <>
                <textarea aria-labelledby="offer-survey-question" placeholder="Ваш ответ" rows={3}
                  value={lastStep && answers.recall_kind !== 'text' ? '' : answers[question.field]}
                  disabled={busy} maxLength={1000} onChange={event => {
                    const value = event.target.value;
                    if (lastStep) setAnswers(previous => ({ ...previous, recall_kind: 'text', recall_text: value }));
                    else update(question.field, value);
                  }} />
                {lastStep && (
                  <fieldset className="offer-survey-shortcuts" aria-label="Готовые ответы" disabled={busy}>
                    {recallOptions.map(([id, label]) => (
                      <button type="button" key={id} aria-pressed={answers.recall_kind === id}
                        onClick={() => update('recall_kind', answers.recall_kind === id ? 'text' : id)}>
                        {label}
                      </button>
                    ))}
                  </fieldset>
                )}
              </>
            )}
          </div>
          <div className="offer-survey-action">
            {step > 0 && (
              <button type="button" className="button button-outline" disabled={busy}
                onClick={() => { setError(false); setStep(step - 1); }}>
                Назад
              </button>
            )}
            <button type="submit" className="button button-dark" disabled={busy || !ready}>
              {busy ? 'Отправляем…' : lastStep ? 'Отправить ответы' : 'Дальше'}
            </button>
          </div>
          {error && <p className="offer-survey-error" role="alert">Ответы не сохранились. Попробуйте отправить их ещё раз.</p>}
        </form>
      )}
    </section>
  );
}
