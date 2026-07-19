document.addEventListener('DOMContentLoaded', function () {
  const legalToggle = document.getElementById('legal-fade-toggle');
  const legalWrap = document.getElementById('legal-fade-wrap');

  if (legalToggle && legalWrap) {
    legalToggle.addEventListener('click', function () {
      const isExpanded = legalWrap.classList.toggle('expanded');
      legalToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });
  }

  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(function (item) {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (!question || !answer) return;

    question.setAttribute('aria-expanded', 'false');

    question.addEventListener('click', function () {
      const isOpen = item.classList.contains('active');

      faqItems.forEach(function (otherItem) {
        otherItem.classList.remove('active');
        const otherQuestion = otherItem.querySelector('.faq-question');
        const otherAnswer = otherItem.querySelector('.faq-answer');
        if (otherQuestion) otherQuestion.setAttribute('aria-expanded', 'false');
        if (otherAnswer) otherAnswer.style.maxHeight = '0px';
      });

      if (!isOpen) {
        item.classList.add('active');
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Validação e navegação do formulário multistep: ver wizard.js
});
