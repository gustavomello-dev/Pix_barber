import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { generatePix } from "./services/pix.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração para resolver caminhos de diretórios no ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Catálogo de serviços da Barbearia (Fonte da verdade no Backend)
const SERVICOS = [
    {
        id: "corte",
        nome: "Corte de Cabelo",
        descricao: "Corte social, degradê ou tesoura",
        valor: 35.0,
    },
    {
        id: "barba",
        nome: "Barba Completa",
        descricao: "Modelagem com toalha quente e navalha",
        valor: 25.0,
    },
    {
        id: "combo",
        nome: "Combo Cabelo + Barba",
        descricao: "Pacote completo com desconto especial",
        valor: 55.0,
    },
    {
        id: "pezinho",
        nome: "Pezinho / Acabamento",
        descricao: "Manutenção rápida dos contornos",
        valor: 15.0,
    },
];

// Rota GET para listar os serviços disponíveis no Frontend
app.get("/api/servicos", (req, res) => {
    res.json(SERVICOS);
});

// Rota POST para gerar a cobrança Pix de um serviço específico
app.post("/api/gerar-pix", async (req, res) => {
    try {
        const { servicoId } = req.body;

        // 1. Busca o serviço no catálogo pelo ID
        const servicoSelecionado = SERVICOS.find((s) => s.id === servicoId);

        if (!servicoSelecionado) {
            return res
                .status(400)
                .json({ erro: "Serviço inválido ou não encontrado." });
        }

        // 2. Valida se a chave Pix foi configurada no .env
        const { PIX_KEY, PIX_MERCHANT_NAME, PIX_MERCHANT_CITY } = process.env;
        if (!PIX_KEY) {
            return res
                .status(500)
                .json({
                    erro: "Chave Pix não configurada no servidor (.env).",
                });
        }

        // 3. Gera um identificador curto para o TXID (ex: BARBCOURTE)
        const txid = `BARB${servicoSelecionado.id.toUpperCase()}`;

        // 4. Chama o serviço gerador de Pix
        const { copiaECola, qrCodeImage } = await generatePix({
            pixKey: PIX_KEY,
            merchantName: PIX_MERCHANT_NAME || "BARBEARIA",
            merchantCity: PIX_MERCHANT_CITY || "SAO PAULO",
            amount: servicoSelecionado.valor,
            txid,
        });

        // 5. Retorna o JSON exatamente no formato definido no escopo
        return res.json({
            copiaECola,
            qrCodeImage,
            servico: servicoSelecionado.nome,
            valor: servicoSelecionado.valor,
        });
    } catch (error) {
        console.error("Erro ao gerar Pix:", error);
        return res
            .status(500)
            .json({ erro: "Falha interna ao gerar o QR Code Pix." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
