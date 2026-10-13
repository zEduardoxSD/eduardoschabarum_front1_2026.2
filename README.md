# Projeto1Front
Projeto 1 da matéria de frontend1


# Schmidt Auto Peças

## 1. Descrição da loja

A Schmidt Auto Peças é um projeto acadêmico de uma loja virtual de peças automotivas. O site permite visualizar produtos, consultar preços, acessar páginas de cadastro e login, visualizar o perfil do cliente e consultar informações de compras.

O projeto foi desenvolvido utilizando HTML e CSS, com foco na estruturação das páginas, na organização dos produtos e na aplicação de estilos responsivos.

## 2. Integrantes

- Eduardo Schabarum do Amarante

## 3. Tecnologias utilizadas

- HTML5
- CSS3

## 4. Estrutura de pastas

```text
Projeto1Front/
├── index.html
├── loja.html
├── cadastro.html
├── login.html
├── perfil.html
├── relatorios.html
├── carrinho.html
├── contato.html
├── style.css
├── relatorios.css
├── imagens/
│   ├── cabos_de_vela.png
│   ├── discos_de_freio.jpg
│   ├── filtro_de_ar.jpeg
│   ├── correia_de_acessorios.jpeg
│   ├── embreamgem.jpg
│   ├── kit_correia_dentata.png
│   ├── pastilhas.jpeg
│   ├── filtro.jpeg
│   ├── vela.png
│   └── oleo.jpg
└── README.md
```
## 5. Como visualizar as telas ocultas

### Confirmação de compra

A página do carrinho contém um bloco de confirmação de compra demonstrativo, inicialmente oculto pelo atributo HTML `hidden`.

Para visualizar a mensagem:

1. Abra o arquivo `carrinho.html`.
2. Localize o elemento com a classe `confirmacao-compra`.
3. Remova o atributo `hidden` da tag de abertura.
4. Salve o arquivo e atualize a página no navegador.

Exemplo:

Antes:

```html
<div class="confirmacao-compra" hidden>
```

Depois:

```html
<div class="confirmacao-compra">
```

A mensagem será exibida com o número de pedido demonstrativo `CP001`.

Para ocultá-la novamente, basta adicionar o atributo `hidden` à tag.
