import React, { useEffect, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { getSurveyGiftCode, submitOfferSurvey } from './analytics.js';
import './survey.css';

const questions = [
  {
    title: 'Как вы оцениваете уровень цен в РИВ ГОШ по сравнению с другими магазинами косметики?',
    field: 'price_level',
    options: [
      ['much_lower', 'Значительно ниже'],
      ['lower', 'Скорее ниже'],
      ['same', 'Примерно такой же'],
      ['higher', 'Скорее выше'],
      ['much_higher', 'Значительно выше'],
      ['unsure', 'Затрудняюсь ответить'],
    ],
  },
  {
    title: 'Насколько вы согласны с утверждением «В РИВ ГОШ можно найти косметику по доступным для меня ценам»?',
    field: 'affordability',
    scale: ['Совсем не согласен', 'Полностью согласен'],
  },
  {
    title: 'Насколько вероятно, что при следующей покупке косметики вы рассмотрите РИВ ГОШ?',
    field: 'purchase_intent',
    scale: ['Крайне маловероятно', 'Очень вероятно'],
  },
  {
    title: 'Как цены в представленной подборке соотносятся с вашими ожиданиями?',
    field: 'price_expectations',
    options: [
      ['much_lower', 'Значительно ниже ожидаемых'],
      ['lower', 'Немного ниже ожидаемых'],
      ['same', 'Соответствуют ожиданиям'],
      ['higher', 'Немного выше ожидаемых'],
      ['much_higher', 'Значительно выше ожидаемых'],
      ['unsure', 'У меня не было определённых ожиданий'],
    ],
  },
  {
    title: 'Что в представленной инициативе могло бы побудить вас посетить РИВ ГОШ?',
    field: 'motivations',
    multiple: true,
    options: [
      ['prices', 'Цены на представленные товары'],
      ['assortment', 'Ассортимент товаров'],
      ['gift', 'Бальзам в подарок'],
      ['location', 'Удобное расположение магазина'],
      ['none', 'Ничего из перечисленного'],
      ['other', 'Другое'],
    ],
  },
  { title: 'Что могло бы помешать вам посетить РИВ ГОШ?', field: 'barrier' },
];

function GiftPass({ code, headingRef }) {
  const url = new URL('/gift/' + encodeURIComponent(code), window.location.origin);
  const qr = qrcode(0, 'M');
  qr.addData(url.href);
  qr.make();
  const image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr.createSvgTag(8));

  return (
    <div className="offer-survey-pass offer-survey-step">
      <div>
        <h2 ref={headingRef} tabIndex={-1}>Ваш QR-код готов</h2>
        <p>Этот демонстрационный код показывает, как могло бы работать получение бальзама. В магазине код не действует.</p>
        <div className="offer-survey-action">
          <a className="button button-dark" href="#shops">Найти магазин</a>
          <a className="text-button" href={image} download="rive-gauche-qr.svg">Сохранить QR-код</a>
        </div>
      </div>
      <img width={212} height={212} src={image} alt="Демонстрационный QR-код учебного проекта" />
    </div>
  );
}

export function OfferSurvey() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState({ motivations: [], motivation_other: '', barrier: '' });
  const [giftCode, setGiftCode] = useState(getSurveyGiftCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const stepHeading = useRef(null);
  const question = questions[step];
  const lastStep = step === questions.length - 1;
  const selected = answers[question?.field];
  const ready = question?.multiple ? selected.length > 0
    : lastStep ? Boolean(selected.trim()) : Boolean(selected);

  useEffect(() => {
    if (step >= 0) stepHeading.current?.focus();
  }, [step, giftCode]);

  function update(field, value) {
    setAnswers(previous => ({ ...previous, [field]: value }));
  }

  function toggleMotivation(option, checked) {
    setAnswers(previous => {
      const selectedOptions = previous.motivations;
      let motivations;
      if (!checked) motivations = selectedOptions.filter(value => value !== option);
      else if (option === 'none') motivations = [option];
      else motivations = [...selectedOptions.filter(value => value !== 'none'), option];
      return { ...previous, motivations };
    });
  }

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
      const code = await submitOfferSurvey({
        ...answers,
        motivation_other: answers.motivations.includes('other') ? answers.motivation_other.trim() : '',
        barrier: answers.barrier.trim(),
      });
      setGiftCode(code);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section offer-survey" id="survey" aria-labelledby="offer-survey-title">
      <div className="wrap offer-survey-inner">
        <h2 id="offer-survey-title" className={question || giftCode ? 'visually-hidden' : undefined}>
          Ответьте на шесть вопросов
        </h2>
        {giftCode ? (
          <GiftPass code={giftCode} headingRef={stepHeading} />
        ) : !question ? (
          <div className="offer-survey-intro">
            <p>После опроса здесь появится демонстрационный QR-код.</p>
            <button type="button" className="button button-dark" onClick={() => setStep(0)}>Начать опрос</button>
          </div>
        ) : (
          <form onSubmit={advance} aria-busy={busy}>
            <p className="offer-survey-progress" id="offer-survey-progress">Вопрос {step + 1} из {questions.length}</p>
            <progress value={step + 1} max={questions.length} aria-labelledby="offer-survey-progress" />
            <div key={step} className="offer-survey-step">
              <h3 id="offer-survey-question" ref={stepHeading} tabIndex={-1}>{question.title}</h3>
              {question.scale ? (
                <fieldset aria-labelledby="offer-survey-question" aria-describedby="offer-survey-scale" disabled={busy}>
                  <div className="offer-survey-scale">
                    {[1, 2, 3, 4, 5].map(value => (
                      <label key={value}>
                        <input type="radio" name={question.field} checked={selected === value}
                          onChange={() => update(question.field, value)} />
                        <span>{value}</span>
                      </label>
                    ))}
                  </div>
                  <div className="offer-survey-scale-labels" id="offer-survey-scale">
                    <span>1 — {question.scale[0].toLowerCase()}</span>
                    <span>5 — {question.scale[1].toLowerCase()}</span>
                  </div>
                </fieldset>
              ) : question.options ? (
                <fieldset aria-labelledby="offer-survey-question" disabled={busy}>
                  {question.multiple && <p className="offer-survey-hint">Можно выбрать несколько вариантов</p>}
                  <div className="offer-survey-options">
                    {question.options.map(([id, label]) => (
                      <label className="offer-survey-option" key={id}>
                        <input type={question.multiple ? 'checkbox' : 'radio'} name={question.field}
                          checked={question.multiple ? selected.includes(id) : selected === id}
                          onChange={event => question.multiple
                            ? toggleMotivation(id, event.target.checked) : update(question.field, id)} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {question.multiple && selected.includes('other') && (
                    <label className="offer-survey-other">
                      Ваш вариант
                      <input type="text" value={answers.motivation_other} maxLength={250}
                        onChange={event => update('motivation_other', event.target.value)} />
                    </label>
                  )}
                </fieldset>
              ) : (
                <textarea aria-labelledby="offer-survey-question" placeholder="Ваш ответ" rows={3}
                  value={selected} disabled={busy} maxLength={1000}
                  onChange={event => update(question.field, event.target.value)} />
              )}
            </div>
            <div className="offer-survey-action">
              {step > 0 && (
                <button type="button" className="text-button" disabled={busy}
                  onClick={() => { setError(false); setStep(step - 1); }}>
                  Назад
                </button>
              )}
              <button type="submit" className="button button-dark" disabled={busy || !ready}>
                {busy ? 'Отправляем…' : lastStep ? 'Получить QR-код' : 'Дальше'}
              </button>
            </div>
            {error && <p className="offer-survey-error" role="alert">Ответы не отправились. Попробуйте ещё раз.</p>}
          </form>
        )}
      </div>
    </section>
  );
}
