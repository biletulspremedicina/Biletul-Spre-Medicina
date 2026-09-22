import Reveal from '@/components/Reveal';
import './WhyChooseUs.css';

const advantages = [
  {
    number: '01',
    title: 'Simulări complete și pe capitole',
    description:
      'Exersezi din întreaga materie de Biologie, pe capitole și pe subiecte de admitere din anii anteriori la UMFCD.',
  },
  {
    number: '02',
    title: 'Explicații care clarifică greșelile',
    description:
      'După simulare vezi răspunsurile și explicațiile, ca să înțelegi logica din spatele fiecărei grile.',
  },
  {
    number: '03',
    title: 'Progres pe care îl poți urmări',
    description:
      'Îți urmărești rezultatele, ritmul de lucru și capitolele în care ai nevoie de mai mult exercițiu.',
  },
];

const answers = [
  { letter: 'A', text: 'Cortexul suprarenal' },
  { letter: 'B', text: 'Hipofiza posterioară', correct: true },
  { letter: 'C', text: 'Glanda tiroidă' },
  { letter: 'D', text: 'Pancreasul' },
];

function ExamPreview() {
  return (
    <div className="why-preview" aria-label="Exemplu vizual de revizuire a unei simulări de biologie">
      <div className="why-preview-header">
        <div className="why-preview-heading">
          <strong>Simulare biologie</strong>
          <span>Revizuirea răspunsurilor · exemplu de interfață</span>
        </div>
        <div className="why-preview-progress" aria-hidden="true">
          <span>Întrebarea 12 din 60</span>
          <div><i /></div>
        </div>
        <div className="why-preview-time">
          <small>Timp folosit</small>
          <strong>01:12:34</strong>
        </div>
      </div>

      <div className="why-preview-content">
        <div className="why-preview-question">
          <div className="why-preview-question-top">
            <strong>Întrebarea 12</strong>
            <span>Un singur răspuns corect</span>
          </div>
          <h4>Din ce structură este eliberat în sânge hormonul antidiuretic (ADH)?</h4>
          <div className="why-preview-options">
            {answers.map(({ letter, text, correct }) => (
              <div key={letter} className={`why-preview-option${correct ? ' is-correct' : ''}`}>
                <span>{letter}</span>
                <strong>{text}</strong>
                {correct && <b aria-label="Răspuns corect">✓</b>}
              </div>
            ))}
          </div>
          <div className="why-preview-navigation" aria-hidden="true">
            <span>← Întrebarea anterioară</span>
            <span>Întrebarea următoare →</span>
          </div>
        </div>

        <div className="why-preview-explanation">
          <h4>Răspuns și explicație</h4>
          <div className="why-preview-correct">
            <span aria-hidden="true">✓</span>
            <strong>Răspuns corect: B. Hipofiza posterioară</strong>
          </div>
          <p>
            Hormonul antidiuretic este sintetizat în hipotalamus, apoi eliberat
            în sânge de hipofiza posterioară. El ajută rinichii să reabsoarbă apa.
          </p>
          <h5>De ce celelalte variante sunt incorecte?</h5>
          <ul className="why-preview-other-answers">
            <li><span>A</span><p><strong>Cortexul suprarenal</strong> produce hormoni precum cortizolul.</p></li>
            <li><span>C</span><p><strong>Glanda tiroidă</strong> secretă hormoni care reglează metabolismul.</p></li>
            <li><span>D</span><p><strong>Pancreasul</strong> produce insulină și glucagon.</p></li>
          </ul>
          <div className="why-preview-takeaway">
            <strong>De reținut</strong>
            <p>Nu doar afli varianta corectă — înțelegi de ce este corectă.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WhyChooseUs() {
  return (
    <section id="de-ce-noi" className="why-editorial" aria-labelledby="why-choose-us-title">
      <div className="why-editorial-photo" aria-hidden="true" />
      <div className="why-editorial-inner">
        <Reveal className="why-editorial-intro">
          <p className="why-editorial-eyebrow">
            DE CE BILETUL SPRE MEDICINĂ <span aria-hidden="true" />
          </p>
          <h2 id="why-choose-us-title">
            Exersezi ca la examen.<br />Înveți din fiecare răspuns.
          </h2>
          <p className="why-editorial-lead">
            Simulări realiste, explicații clare și un parcurs care te duce mai
            aproape de locul tău la Medicină.
          </p>
        </Reveal>

        <div className="why-editorial-stage">
          <div className="why-editorial-benefits">
            {advantages.map((advantage, index) => (
              <Reveal key={advantage.number} delay={100 + index * 110}>
                <div className="why-editorial-benefit">
                  <span className="why-editorial-number" aria-hidden="true">{advantage.number}</span>
                  <div>
                    <h3>{advantage.title}</h3>
                    <p>{advantage.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="why-editorial-preview-wrap" delay={280}>
            <ExamPreview />
          </Reveal>
        </div>

        <div className="why-editorial-footer">
          <Reveal delay={140}>
            <div className="why-editorial-footer-item">
              <span className="why-editorial-footer-index" aria-hidden="true">I.</span>
              <div>
                <h3>Creat de profesori și studenți</h3>
                <p>Pregătire gândită de oameni care cunosc materia și parcursul tău.</p>
              </div>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="why-editorial-footer-item">
              <span className="why-editorial-footer-index" aria-hidden="true">II.</span>
              <div>
                <h3>Suport uman când ai nevoie</h3>
                <p>Pentru întrebări despre platformă, simulări sau materie, de luni până vineri, 08:00–17:00.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
