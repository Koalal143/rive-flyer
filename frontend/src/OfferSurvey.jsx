import React, { useState } from 'react';
import { getSurveyAnswer, submitSurvey } from './analytics.js';
import './survey.css';

const choices = [
  ['store_interest', 'Меня заинтересовал магазин в целом'],
  ['gift_only', 'Я бы пришёл только за подарком'],
  ['neutral', 'Скорее нейтрально'],
  ['no_visit', 'Точно не пришёл бы за подарком'],
];

export function OfferSurvey() {
  const [choice, setChoice] = useState('');
  const [answer, setAnswer] = useState(getSurveyAnswer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!choice || busy) return;
    setBusy(true);
    setError(false);
    try {
      setAnswer(await submitSurvey(choice));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="wrap section offer-survey" aria-labelledby="offer-survey-title">
      <h2 id="offer-survey-title">Как вы оцениваете наше предложение?</h2>
      {answer ? (
        <div className="offer-survey-thanks" role="status">
          <strong>Спасибо за ответ!</strong>
          <p>{choices.find(([id]) => id === answer)?.[1]}</p>
        </div>
      ) : (
        <form onSubmit={submit} aria-busy={busy}>
          <fieldset disabled={busy}>
            <legend className="visually-hidden">Выберите один вариант</legend>
            <div className="offer-survey-options">
              {choices.map(([id, label]) => (
                <label className="offer-survey-option" key={id}>
                  <input type="radio" name="offer-rating" value={id} checked={choice === id}
                    onChange={() => setChoice(id)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="offer-survey-action">
            <button type="submit" className="button button-dark" disabled={busy || !choice}>
              {busy ? 'Отправляем…' : 'Отправить ответ'}
            </button>
            {error && <p role="alert">Ответ не сохранился. Попробуйте ещё раз.</p>}
          </div>
        </form>
      )}
    </section>
  );
}
