"""Self-check das decisões de afinação do agente (Setembro 2026).

Corre com:  python livekit-agent/test_config.py

Não substitui uma chamada real — protege apenas o que uma chamada real não
apanha depressa: uma regressão silenciosa numa destas escolhas.
"""
import os
import re
from pathlib import Path

HERE = Path(__file__).parent
SRC = (HERE / "agent.py").read_text()
PROMPT = (HERE / "system-prompt.txt").read_text()


def check_model_is_pinned():
    """O alias -latest troca de modelo sem aviso: a demo tem de soar igual
    entre duas apresentações."""
    default = re.search(
        r'GEMINI_REALTIME_MODEL\s*=\s*os\.environ\.get\(\s*\n?\s*"GEMINI_REALTIME_MODEL",\s*"([^"]+)"',
        SRC,
    )
    assert default, "GEMINI_REALTIME_MODEL desapareceu do agent.py"
    assert not default.group(1).endswith("-latest"), (
        f"modelo por omissão voltou a ser um alias móvel: {default.group(1)}"
    )
    assert "gemini-2.5-flash-native-audio-latest" not in SRC, (
        "o alias -latest está outra vez escrito no código"
    )


def check_vad_is_configurable():
    """Os 600ms eram mais de metade da latência percebida; o valor tem de
    continuar afinável sem novo deploy de código."""
    assert "VAD_SILENCE_MS" in SRC, "VAD_SILENCE_MS desapareceu"
    assert "silence_duration_ms=VAD_SILENCE_MS" in SRC, (
        "silence_duration_ms voltou a estar fixo no código"
    )
    d = int(re.search(r'"VAD_SILENCE_MS",\s*"(\d+)"', SRC).group(1))
    assert 250 <= d <= 700, f"VAD_SILENCE_MS por omissão fora do intervalo sensato: {d}"


def check_never_opens_by_asking_to_repeat():
    """A causa raiz do 'desculpa, não te ouvi bem' no arranque estava no
    prompt, não no VAD: era uma instrução literal."""
    assert "NUNCA comeces uma conversa a pedir para repetir" in PROMPT, (
        "a regra que impede abrir a pedir repetição desapareceu do prompt"
    )
    assert "duas vezes seguidas" in PROMPT, (
        "o pedido de repetição deixou de exigir dois fragmentos seguidos"
    )


def check_european_portuguese_is_consistent():
    """O prompt antigo mandava tratar por 'tu' e depois tratava por 'você'
    em metade das perguntas."""
    for termo in (" você ", " Que tipo de negócio tem?", " o seu negócio"):
        assert termo not in PROMPT, f"tratamento inconsistente reintroduzido: {termo!r}"


def check_tools_still_documented():
    """O prompt encolheu 43%: as ferramentas não podem ter ido no corte."""
    for tool in ("book_meeting", "transfer_to_human", "wrap_up_call"):
        assert tool in PROMPT, f"{tool} deixou de estar documentado no prompt"


def check_prompt_stays_lean():
    """Cada palavra aqui é reenviada em todos os turnos e paga-se em TTFT.
    1873 tokens era o ponto de partida; 1067 o resultado da reescrita."""
    palavras = len(PROMPT.split())
    assert palavras < 850, (
        f"o prompt voltou a crescer ({palavras} palavras); estava em 680 após a reescrita"
    )


if __name__ == "__main__":
    checks = [v for k, v in sorted(globals().items()) if k.startswith("check_")]
    for c in checks:
        c()
        print(f"  ok  {c.__name__}")
    print(f"\n{len(checks)} verificações passaram.")
