import json
import logging
from functools import lru_cache
import sys
import types
from pathlib import Path
from typing import Dict, Union

import torch
import torch.nn as nn
from torch.serialization import add_safe_globals
from PIL import Image
from torchvision import transforms

# Import your model architecture
from app.ml.mobilenetv3 import get_model, MobileNetV3Classifier

logger = logging.getLogger(__name__)

# Resolve repo root (FYP-WebApp)
BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "saved_models" / "global_model.pth"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Update this mapping to match the 8 training classes
# Order assumed: ADI, DEB, LYM, MUC, MUS, NOR, STR, TUM
IDX_TO_LABEL = {
    0: "ADI",
    1: "DEB",
    2: "LYM",
    3: "MUC",
    4: "MUS",
    5: "NOR",
    6: "STR",
    7: "TUM",
}

_transform = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


@lru_cache(maxsize=1)
def _load_model():
    """
    Load the model once. Works with either a full serialized model or a
    state_dict saved from the FL server.
    """
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")

    # Allowlist our model class in case the checkpoint is a full serialized model
    add_safe_globals([MobileNetV3Classifier])

    # Provide legacy module aliases for checkpoints pickled with a different path
    # (e.g., "models.mobilenetv3.MobileNetV3Classifier")
    legacy_module_name = "models.mobilenetv3"
    if legacy_module_name not in sys.modules:
        legacy_pkg = sys.modules.setdefault("models", types.ModuleType("models"))
        sys.modules[legacy_module_name] = sys.modules[__name__.rsplit(".", 1)[0] + ".mobilenetv3"]
        setattr(legacy_pkg, "mobilenetv3", sys.modules[legacy_module_name])

    # PyTorch 2.6 defaults weights_only=True; explicitly disable so full-model
    # checkpoints load without UnpicklingError. This file is assumed trusted.
    checkpoint = torch.load(str(MODEL_PATH), map_location=DEVICE, weights_only=False)

    # Handle both full-model checkpoints and plain state_dict exports
    if isinstance(checkpoint, nn.Module):
        model = checkpoint
    else:
        model = get_model(num_classes=8, variant="small", pretrained=False)
        state_dict = checkpoint
        if isinstance(state_dict, dict) and "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        if isinstance(state_dict, dict):
            model.load_state_dict(state_dict)
        else:
            raise RuntimeError(f"Unexpected model format: {type(checkpoint)}")

    # Step 4: Set to evaluation mode
    model.to(DEVICE).eval()
    logger.info("✅ Model loaded successfully from %s", MODEL_PATH)
    return model


def _postprocess_output(output: torch.Tensor) -> Dict[str, Union[str, float]]:
    """
    Convert model raw output to label/confidence.
    Supports:
    - shape [B, C] logits (softmax)
    - shape [B] logits (sigmoid for binary)
    """
    if output.ndim == 1:
        output = output.unsqueeze(0)

    if isinstance(output, (list, tuple)):
        output = output[0]
        if isinstance(output, (list, tuple)):
            output = output[0]

    if output.ndim != 2:
        raise RuntimeError(f"Unexpected model output shape: {tuple(output.shape)}")

    if output.shape[1] == 1:
        probs = torch.sigmoid(output)
        conf = probs[0, 0].item()
        label_idx = 1 if conf >= 0.5 else 0
        confidence = conf if label_idx == 1 else 1 - conf
    else:
        probs = torch.softmax(output, dim=1)
        conf_val, idx_val = torch.max(probs, dim=1)
        label_idx = int(idx_val[0].item())
        confidence = float(conf_val[0].item())

    label = IDX_TO_LABEL.get(label_idx, str(label_idx))
    return {"label": label, "confidence": round(confidence, 4)}


def predict(image_path: str) -> str:
    """
    Run inference on an image path and return a JSON string payload
    to match the existing API schema.
    """
    model = _load_model()

    img = Image.open(image_path).convert("RGB")
    tensor = _transform(img).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        output = model(tensor)
    # Debug: log raw model output shape and a small sample
    try:
        sample_vals = output[0].detach().cpu().numpy().tolist()
        logger.info("Model raw output shape: %s sample: %s", tuple(output.shape), sample_vals[:5])
    except Exception as exc:  # pragma: no cover - debug logging
        logger.warning("Unable to log raw output sample: %s", exc)

    result = _postprocess_output(output)
    logger.info("Postprocessed inference result: %s", result)
    return json.dumps(result)
