<?php
/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2014 (original work) Open Assessment Technologies SA;
 *
 *
 */

namespace oat\tao\model\menu;

use oat\oatbox\PhpSerializable;
use tao_models_classes_accessControl_AclProxy;

class Icon implements PhpSerializable
{
    const SERIAL_VERSION = 1392821334;
    
    protected $data;
    
    public static function fromSimpleXMLElement(\SimpleXMLElement $node) {
        return new static(array(
            'id' => (string) $node['id'],
            'src' => isset($node['src']) ? (string) $node['src'] : null,
        ));
    }
    
    public static function createLegacyItem($iconId) {
        return new static(array(
            'id' => (string)$iconId,
            'src' => null,
        ));
    }
    
    public function __construct($data, $version = self::SERIAL_VERSION) {
        $this->data = $data;
    }
    
    public function getId() {
        return $this->data['id'];
    }
    
    public function getSource() {
        return $this->data['src'];
    }
    
    public function __toPhpCode() {
        return "new ".__CLASS__."("
            .\common_Utils::toPHPVariableString($this->data).','
            .\common_Utils::toPHPVariableString(self::SERIAL_VERSION)
        .")";
    }
}
