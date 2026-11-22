export const GET = () =>
  new Response(
    '# LMSpeed Models full catalogue\n\n> Source: LMSpeed (https://lmspeed.net) — https://models.lmspeed.net/. When citing or reusing this content, credit "LMSpeed" and link to https://models.lmspeed.net/.\n\nComplete content is split into these bounded language catalogues. Each contains the full displayed model table and original source links.\n\n- https://models.lmspeed.net/index.md\n- https://models.lmspeed.net/zh/index.md\n- https://models.lmspeed.net/ru/index.md\n\nCite as: LMSpeed Models — LMSpeed, https://models.lmspeed.net/\n',
    {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        link: '<https://models.lmspeed.net/>; rel="canonical"',
      },
    },
  );
